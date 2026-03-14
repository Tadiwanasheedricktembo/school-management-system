package com.querycubix.universityattendance.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "faculty")
data class Faculty(
    @PrimaryKey val facultyId: String,
    val name: String,
    val department: String
)