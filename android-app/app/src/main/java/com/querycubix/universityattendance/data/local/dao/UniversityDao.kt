package com.querycubix.universityattendance.data.local.dao

import androidx.room.*
import com.querycubix.universityattendance.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface UniversityDao {
    // Students
    @Query("SELECT * FROM students")
    fun getAllStudents(): Flow<List<Student>>

    @Query("SELECT * FROM students WHERE regNo = :regNo")
    fun getStudent(regNo: String): Flow<Student?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStudent(student: Student)

    @Delete
    suspend fun deleteStudent(student: Student)

    // Courses
    @Query("SELECT * FROM courses")
    fun getAllCourses(): Flow<List<Course>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCourse(course: Course)

    // Student-Course Many-to-Many
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun enrollStudentInCourse(crossRef: StudentCourseCrossRef)

    @Query("""
        SELECT * FROM courses 
        INNER JOIN student_course_cross_ref ON courses.courseCode = student_course_cross_ref.courseCode 
        WHERE student_course_cross_ref.regNo = :studentRegNo
    """)
    fun getCoursesForStudent(studentRegNo: String): Flow<List<Course>>

    // Attendance
    @Query("SELECT * FROM attendance_logs")
    fun getAllAttendance(): Flow<List<Attendance>>

    @Query("SELECT * FROM attendance_logs WHERE studentRegNo = :studentId")
    fun getAttendanceForStudent(studentId: String): Flow<List<Attendance>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(attendance: Attendance)

    @Update
    suspend fun updateAttendance(attendance: Attendance)

    @Delete
    suspend fun deleteAttendance(attendance: Attendance)

    // Assessments
    @Query("SELECT * FROM assessments")
    fun getAllAssessments(): Flow<List<Assessment>>

    @Query("SELECT * FROM assessments WHERE courseCode = :courseId")
    fun getAssessmentsForCourse(courseId: String): Flow<List<Assessment>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAssessment(assessment: Assessment)

    // Payments
    @Query("SELECT * FROM payments")
    fun getAllPayments(): Flow<List<Payment>>

    @Query("SELECT * FROM payments WHERE studentId = :studentId")
    fun getPaymentsForStudent(studentId: String): Flow<List<Payment>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayment(payment: Payment)

    // Timetable
    @Query("SELECT * FROM timetable_entries ORDER BY dayOfWeek ASC, startTime ASC")
    fun getAllTimetableEntries(): Flow<List<TimetableEntry>>

    @Query("""
        SELECT timetable_entries.* FROM timetable_entries
        INNER JOIN student_course_cross_ref ON timetable_entries.courseCode = student_course_cross_ref.courseCode
        WHERE student_course_cross_ref.regNo = :studentId
        ORDER BY dayOfWeek ASC, startTime ASC
    """)
    fun getTimetableForStudent(studentId: String): Flow<List<TimetableEntry>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTimetableEntry(entry: TimetableEntry)

    @Update
    suspend fun updateTimetableEntry(entry: TimetableEntry)

    @Delete
    suspend fun deleteTimetableEntry(entry: TimetableEntry)

    // --- Legacy / Existing methods preserved ---
    @Query("SELECT * FROM fees WHERE studentRegNo = :regNo")
    fun getFeesForStudent(regNo: String): Flow<List<Fee>>

    @Query("SELECT SUM(amountDue - amountPaid) FROM fees WHERE studentRegNo = :regNo")
    fun getTotalOutstandingAmount(regNo: String): Flow<Double?>

    @Query("SELECT * FROM assignments WHERE isSubmitted = :isSubmitted")
    fun getAssignmentsByStatus(isSubmitted: Boolean): Flow<List<Assignment>>

    @Update
    suspend fun updateAssignment(assignment: Assignment)

    @Query("SELECT * FROM timetable_slots WHERE dayOfWeek = :day ORDER BY startTime ASC")
    fun getTimeTableForDay(day: Int): Flow<List<TimeTableSlot>>
}
