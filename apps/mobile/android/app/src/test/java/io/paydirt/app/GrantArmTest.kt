package io.paydirt.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GrantArmTest {

    private var now = 1_000L
    private val arm = GrantArm(windowMs = 100L, clock = { now })

    @Test
    fun `is not armed until a grant is requested`() {
        assertFalse(arm.isArmed)
    }

    @Test
    fun `is armed inside the window`() {
        arm.arm()
        now += 99
        assertTrue(arm.isArmed)
    }

    @Test
    fun `expires after the window`() {
        arm.arm()
        now += 100
        assertFalse(arm.isArmed)
    }

    @Test
    fun `disarm clears immediately`() {
        arm.arm()
        arm.disarm()
        assertFalse(arm.isArmed)
    }

    @Test
    fun `re-arming extends the window`() {
        arm.arm()
        now += 90
        arm.arm()
        now += 90
        assertTrue(arm.isArmed)
    }
}
