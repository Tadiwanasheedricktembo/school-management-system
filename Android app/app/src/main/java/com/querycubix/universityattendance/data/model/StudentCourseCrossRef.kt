package com.querycubix.universityattendance.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(
    tableName = "student_course_cross_ref",
    primaryKeys = ["regNo", "courseCode"],
    foreignKeys = [
        ForeignKey(
            entity = Student::class,
            parentColumns = ["regNo"],
            childColumns = ["regNo"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Course::class,
            parentColumns = ["courseCode"],
            childColumns = ["courseCode"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("courseCode")]
)
data class StudentCourseCrossRef(
    val regNo: String,
    val courseCode: String
)
