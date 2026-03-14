package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "assessments",
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
data class Assessment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val courseCode: String,
    val title: String,
    val type: String, // e.g., "Exam", "Quiz", "Assignment"
    val weightage: Int, // percentage
    val dueDate: Long,
    val maxMarks: Int,
    val marksObtained: Int? = null
)
