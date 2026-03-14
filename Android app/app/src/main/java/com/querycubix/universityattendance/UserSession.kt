package com.querycubix.universityattendance

import android.content.Context
import android.content.SharedPreferences

enum class UserRole { STUDENT, FACULTY, ADMIN }

class UserSession(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("user_session", Context.MODE_PRIVATE)

    var userRole: UserRole
        get() = UserRole.valueOf(prefs.getString("role", UserRole.STUDENT.name) ?: UserRole.STUDENT.name)
        set(value) = prefs.edit().putString("role", value.name).apply()

    var userName: String
        get() = prefs.getString("user_name", "Tadiwa Edrick") ?: "Tadiwa Edrick"
        set(value) = prefs.edit().putString("user_name", value).apply()

    var userPrn: String
        get() = prefs.getString("user_prn", "2026-CS-001") ?: "2026-CS-001"
        set(value) = prefs.edit().putString("user_prn", value).apply()

    var lastRollNumber: String
        get() = prefs.getString("last_roll_number", "") ?: ""
        set(value) = prefs.edit().putString("last_roll_number", value).apply()
}
