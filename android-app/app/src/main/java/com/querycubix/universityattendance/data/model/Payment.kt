package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "payments",
    foreignKeys = [
        ForeignKey(
            entity = Student::class,
            parentColumns = ["regNo"],
            childColumns = ["studentId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("studentId")]
)
data class Payment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val studentId: String,
    val amount: Double,
    val type: String,   // e.g., "Tuition", "Library", "Exam Fee"
    val status: String, // e.g., "Completed", "Pending"
    val date: Long
)
