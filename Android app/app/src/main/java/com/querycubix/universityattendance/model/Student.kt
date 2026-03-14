package com.querycubix.universityattendance.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "students")
data class Student(
    @PrimaryKey val regNo: String,
    val name: String,
    val prn: String,
    val admissionNo: String,
    val currentSemester: Int,
    val profileImageUrl: String? = null
)