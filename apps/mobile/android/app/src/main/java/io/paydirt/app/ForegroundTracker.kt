package io.paydirt.app

/**
 * Counts started activities. Pure Kotlin — no Android imports — so JVM unit
 * tests exercise the real logic (see app/src/test).
 */
class ForegroundCounter {
    @Volatile
    private var startedCount = 0

    fun onActivityStarted() {
        startedCount += 1
    }

    fun onActivityStopped() {
        if (startedCount > 0) startedCount -= 1
    }

    val isForeground: Boolean
        get() = startedCount > 0

    /**
     * Silent while our own UI is up — the screen already updates live via
     * realtime, and a heads-up notification on top of the open app is the
     * "duplicate notification" smoke-test finding (2026-10-21). Backgrounded
     * or killed: still post, that's the only surface that reaches the user.
     */
    fun shouldPostNotification(): Boolean = !isForeground
}

/**
 * Process-wide tracker. MainApplication feeds it via
 * ActivityLifecycleCallbacks; UnifiedPushReceiver asks before notifying.
 */
object ForegroundTracker {
    val counter = ForegroundCounter()
}
