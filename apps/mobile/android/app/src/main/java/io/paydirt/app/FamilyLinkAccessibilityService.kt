package io.paydirt.app

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.content.ContextCompat

// Phase 2: Automatically taps Family Link's "Grant Bonus Time" (or "Approve") button
// when PayDirt emits ACTION_GRANT_SCREEN_TIME. The parent approves a spend request in
// PayDirt → RN fires the broadcast → this service opens Family Link and taps the button.
//
// Enable via: Settings → Accessibility → PayDirt → toggle on.
// The web/mobile UI should deep-link to accessibility settings when this isn't enabled.
class FamilyLinkAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "PayDirtA11y"

        // Broadcast fired by the RN layer (or directly from UnifiedPushReceiver)
        // when a spend-approval needs to be mirrored in Family Link.
        const val ACTION_GRANT_SCREEN_TIME = "io.paydirt.app.ACTION_GRANT_SCREEN_TIME"

        // Family Link parental app package and button text candidates.
        private const val FAMILY_LINK_PKG = "com.google.android.apps.kids.familylinkparental"
        private val GRANT_BUTTON_LABELS = listOf(
            "Grant bonus time",
            "Approve",
            "Allow",
        )

        // Check if the service is enabled (heuristic: service connects → writes a flag file).
        fun isEnabled(context: Context): Boolean {
            return java.io.File(context.filesDir, "a11y_enabled.flag").exists()
        }
    }

    // Receiver that the RN layer (or UnifiedPushReceiver) broadcasts to trigger automation.
    private val grantReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == ACTION_GRANT_SCREEN_TIME) {
                Log.d(TAG, "Grant screen time triggered — launching Family Link")
                launchFamilyLink()
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "Service connected")
        java.io.File(filesDir, "a11y_enabled.flag").createNewFile()
        ContextCompat.registerReceiver(
            this,
            grantReceiver,
            IntentFilter(ACTION_GRANT_SCREEN_TIME),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        // Only act on Family Link windows.
        if (event.packageName?.toString() != FAMILY_LINK_PKG) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                val root = rootInActiveWindow ?: return
                if (tryTapGrantButton(root)) {
                    Log.i(TAG, "Tapped grant button in Family Link")
                }
                root.recycle()
            }
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(grantReceiver)
        java.io.File(filesDir, "a11y_enabled.flag").delete()
        Log.i(TAG, "Service destroyed")
    }

    // Walk the view tree looking for a clickable button whose text matches a known
    // grant label. Returns true if a button was found and clicked.
    private fun tryTapGrantButton(node: AccessibilityNodeInfo): Boolean {
        val text = node.text?.toString()?.trim() ?: ""
        val desc = node.contentDescription?.toString()?.trim() ?: ""
        val label = text.ifEmpty { desc }

        if (node.isClickable && GRANT_BUTTON_LABELS.any { label.contains(it, ignoreCase = true) }) {
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (tryTapGrantButton(child)) {
                child.recycle()
                return true
            }
            child.recycle()
        }
        return false
    }

    // Brings Family Link to the foreground. The user must have it installed; if not,
    // this is a no-op (startActivity won't resolve and will throw, caught here).
    private fun launchFamilyLink() {
        try {
            val intent = packageManager.getLaunchIntentForPackage(FAMILY_LINK_PKG)
                ?: run {
                    Log.w(TAG, "Family Link not installed")
                    return
                }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch Family Link: ${e.message}")
        }
    }
}
