package io.paydirt.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONException
import org.json.JSONObject
import java.io.File

// Handles UnifiedPush protocol intents from the ntfy distributor.
// Messages arrive as JSON {"title":"…","body":"…","type":"…"} — sent by PocketBase hooks
// POSTing to the endpoint stored in users.up_endpoint. `type` is optional; when present it
// both drives Phase 2 automation (see FamilyLinkAccessibilityService) and, here, which
// screen tapping the notification should open.
class UnifiedPushReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "paydirt-alerts"
        const val ENDPOINT_FILE = "up_endpoint.txt"

        // paydirt://notification?type=<type> — read by the RN Linking listener in App.tsx,
        // which maps `type` to the screen/tab to open. Unknown/absent types still open the
        // app on tap (just without a specific destination) rather than being dropped.
        private const val DEEP_LINK_SCHEME = "paydirt"
        private const val DEEP_LINK_HOST = "notification"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "org.unifiedpush.android.connector.NEW_ENDPOINT" -> {
                val endpoint = intent.getStringExtra("endpoint") ?: return
                File(context.filesDir, ENDPOINT_FILE).writeText(endpoint)
            }

            "org.unifiedpush.android.connector.MESSAGE" -> {
                val bytes = intent.getByteArrayExtra("bytesMessage") ?: return
                try {
                    val json = JSONObject(String(bytes, Charsets.UTF_8))
                    showNotification(
                        context,
                        json.optString("title", "PayDirt"),
                        json.optString("body", ""),
                        json.optString("type", ""),
                    )
                } catch (_: JSONException) { }
            }

            "org.unifiedpush.android.connector.UNREGISTERED" -> {
                File(context.filesDir, ENDPOINT_FILE).delete()
                // Re-register so we get a fresh endpoint on next app start.
                registerWithNtfy(context)
            }
        }
    }

    private fun showNotification(context: Context, title: String, body: String, type: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Channel creation is idempotent — safe even if the JS side already made it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PayDirt Alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { enableVibration(true) }
            nm.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(buildContentIntent(context, type))
            .build()

        nm.notify(System.currentTimeMillis().toInt(), notification)
    }

    // Launches MainActivity with a paydirt:// deep link carrying the payload's `type` so the
    // RN layer can route to the relevant screen. Targets MainActivity explicitly, so this
    // doesn't depend on AndroidManifest intent-filter resolution to open our own app.
    private fun buildContentIntent(context: Context, type: String): PendingIntent {
        val uri = Uri.Builder().scheme(DEEP_LINK_SCHEME).authority(DEEP_LINK_HOST).apply {
            if (type.isNotEmpty()) appendQueryParameter("type", type)
        }.build()

        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = uri
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}

// Sends a REGISTER broadcast to ntfy. Ntfy returns the existing endpoint if
// still valid, or a fresh one — either way NEW_ENDPOINT fires and updates the file.
// Package is hardcoded to io.heckel.ntfy; switching to a self-hosted instance
// only requires re-registering (the endpoint URL itself encodes the server).
internal fun registerWithNtfy(context: Context) {
    val intent = Intent("org.unifiedpush.android.connector.REGISTER").apply {
        setPackage("io.heckel.ntfy")
        putExtra("token", context.packageName)
        putExtra("application", context.packageName)
    }
    context.sendBroadcast(intent)
}
