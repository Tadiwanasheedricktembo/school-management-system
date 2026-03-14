package com.querycubix.universityattendance.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "fees")
data class Fee(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val studentRegNo: String,
    val category: String, // Hostel, Academic, etc.
    val amountDue: Double,
    val amountPaid: Double,
    val dueDate: Long
)