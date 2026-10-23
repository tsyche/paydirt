package io.paydirt.app

/**
 * Time-boxed "a grant is pending" flag for the Family Link accessibility service.
 * Pure Kotlin so JVM unit tests exercise the real logic (see app/src/test).
 *
 * The service must only tap Family Link buttons right after PayDirt asked it to;
 * otherwise opening Family Link by hand (or an unrelated approval request) would
 * get auto-approved.
 */
class GrantArm(
    private val windowMs: Long = DEFAULT_WINDOW_MS,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    @Volatile
    private var armedUntil = 0L

    fun arm() {
        armedUntil = clock() + windowMs
    }

    fun disarm() {
        armedUntil = 0L
    }

    val isArmed: Boolean
        get() = clock() < armedUntil

    companion object {
        const val DEFAULT_WINDOW_MS = 60_000L
    }
}

/**
 * Parent-side Family Link package names, in launch-preference order. Observed
 * on-device (Pixel 8, 2026-10-23): `familylink`. The child-side
 * `familylinkhelper` must never match — automation runs on the parent's phone.
 */
object FamilyLinkPackages {
    val PARENT = listOf(
        "com.google.android.apps.kids.familylink",
        "com.google.android.apps.kids.familylinkparental",
    )

    fun isParentApp(pkg: String?): Boolean = pkg in PARENT
}
