package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "assignments")
data class Assignment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val subjectCode: String,
    val professorId: String,
    val dueDate: Long,
    val isSubmitted: Boolean = false
)
