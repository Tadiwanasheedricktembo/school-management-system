package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "attendance_logs",
    foreignKeys = [
        ForeignKey(
            entity = Student::class,
            parentColumns = ["regNo"],
            childColumns = ["studentRegNo"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Course::class,
            parentColumns = ["courseCode"],
            childColumns = ["courseCode"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index("studentRegNo"),
        Index("courseCode")
    ]
)
data class Attendance(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val studentRegNo: String,
    val courseCode: String,
    val date: Long,
    val status: String // "Present", "Absent", "Late"
)
