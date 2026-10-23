package io.paydirt.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FamilyLinkPackagesTest {

    @Test
    fun `matches the parent app package observed on-device`() {
        assertTrue(FamilyLinkPackages.isParentApp("com.google.android.apps.kids.familylink"))
    }

    @Test
    fun `never matches the child-side helper`() {
        assertFalse(FamilyLinkPackages.isParentApp("com.google.android.apps.kids.familylinkhelper"))
    }

    @Test
    fun `ignores null and unrelated packages`() {
        assertFalse(FamilyLinkPackages.isParentApp(null))
        assertFalse(FamilyLinkPackages.isParentApp("io.paydirt.app"))
    }
}
