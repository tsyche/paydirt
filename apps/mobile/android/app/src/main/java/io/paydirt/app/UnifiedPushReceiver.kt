package io.paydirt.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONException
import org.json.JSONObject
import java.io.File

// Handles UnifiedPush protocol intents from the ntfy distributor.
// Messages arrive as JSON {"title":"…","body":"…"} — sent by PocketBase hooks
// POSTing to the endpoint stored in users.up_endpoint.
class UnifiedPushReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "paydirt-alerts"
        const val ENDPOINT_FILE = "up_endpoint.txt"
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

    private fun showNotification(context: Context, title: String, body: String) {
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
            .build()

        nm.notify(System.currentTimeMillis().toInt(), notification)
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
