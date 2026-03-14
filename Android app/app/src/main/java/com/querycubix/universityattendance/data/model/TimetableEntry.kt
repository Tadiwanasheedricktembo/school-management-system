package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "timetable_entries",
    foreignKeys = [
        ForeignKey(
            entity = Course::class,
            parentColumns = ["courseCode"],
            childColumns = ["courseCode"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("courseCode")]
)
data class TimetableEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val courseCode: String,
    val dayOfWeek: Int, // 1 = Monday, ..., 7 = Sunday
    val startTime: String,
    val endTime: String,
    val room: String,
    val professor: String
)
