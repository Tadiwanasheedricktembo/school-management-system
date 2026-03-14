package com.querycubix.universityattendance.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "timetable_slots")
data class TimeTableSlot(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val dayOfWeek: Int, // 1 for Monday, etc.
    val startTime: String,
    val endTime: String,
    val subjectCode: String,
    val professorId: String,
    val roomNumber: String
)