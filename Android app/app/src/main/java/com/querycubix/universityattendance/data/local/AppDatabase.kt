package com.querycubix.universityattendance.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.querycubix.universityattendance.data.local.dao.UniversityDao
import com.querycubix.universityattendance.data.model.*

@Database(
    entities = [
        Student::class,
        Course::class,
        Attendance::class,
        Assessment::class,
        Payment::class,
        TimetableEntry::class,
        StudentCourseCrossRef::class,
        Faculty::class,
        TimeTableSlot::class,
        Fee::class,
        Assignment::class
    ],
    version = 4,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun universityDao(): UniversityDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "university_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
