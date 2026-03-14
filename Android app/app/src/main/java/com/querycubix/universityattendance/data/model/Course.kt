package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "courses")
data class Course(
    @PrimaryKey val courseCode: String,
    val courseName: String,
    val facultyName: String,
    val credits: Int
)
