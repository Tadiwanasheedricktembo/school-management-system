package com.querycubix.universityattendance.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "attendance_logs")
data class AttendanceLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val studentRegNo: String,
    val courseCode: String,
    val date: Long,
    val isPresent: Boolean
)