package io.paydirt.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ForegroundTrackerTest {

    @Test
    fun `posts notification when app is not foreground`() {
        val counter = ForegroundCounter()
        assertTrue(counter.shouldPostNotification())
    }

    @Test
    fun `stays silent while an activity is started`() {
        val counter = ForegroundCounter()
        counter.onActivityStarted()
        assertFalse(counter.shouldPostNotification())
        assertTrue(counter.isForeground)
    }

    @Test
    fun `posts again after the last activity stops`() {
        val counter = ForegroundCounter()
        counter.onActivityStarted()
        counter.onActivityStarted() // two activities: config change overlap
        counter.onActivityStopped()
        assertFalse("one still started", counter.shouldPostNotification())
        counter.onActivityStopped()
        assertTrue(counter.shouldPostNotification())
    }

    @Test
    fun `stop without a matching start never goes negative`() {
        val counter = ForegroundCounter()
        counter.onActivityStopped()
        counter.onActivityStopped()
        assertTrue(counter.shouldPostNotification())
        counter.onActivityStarted()
        assertFalse(counter.shouldPostNotification())
    }
}
