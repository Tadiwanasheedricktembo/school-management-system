package com.querycubix.universityattendance.data.model

data class TimetableItem(
    val startTime: String,
    val endTime: String,
    val subject: String,
    val faculty: String
)