package com.querycubix.universityattendance

import android.app.Application
import com.querycubix.universityattendance.data.local.AppDatabase
import com.querycubix.universityattendance.data.repository.UniversityRepository

class UniversityApplication : Application() {
    val database by lazy { AppDatabase.getDatabase(this) }
    val repository by lazy { UniversityRepository(database.universityDao()) }
    val session by lazy { UserSession(this) }
}
