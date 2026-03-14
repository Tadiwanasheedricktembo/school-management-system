package com.querycubix.universityattendance.data.repository

import com.querycubix.universityattendance.data.local.dao.UniversityDao
import com.querycubix.universityattendance.data.model.*
import kotlinx.coroutines.flow.Flow

class UniversityRepository(private val universityDao: UniversityDao) {

    // Students
    fun getStudents(): Flow<List<Student>> = universityDao.getAllStudents()
    
    fun getStudent(regNo: String): Flow<Student?> = universityDao.getStudent(regNo)

    suspend fun insertStudent(student: Student) = universityDao.insertStudent(student)

    // Courses
    fun getCourses(): Flow<List<Course>> = universityDao.getAllCourses()

    fun getCoursesForStudent(regNo: String): Flow<List<Course>> = 
        universityDao.getCoursesForStudent(regNo)

    suspend fun insertCourse(course: Course) = universityDao.insertCourse(course)

    suspend fun enrollStudentInCourse(regNo: String, courseCode: String) {
        universityDao.enrollStudentInCourse(StudentCourseCrossRef(regNo, courseCode))
    }

    // Attendance
    fun getAttendance(studentId: String): Flow<List<Attendance>> = 
        universityDao.getAttendanceForStudent(studentId)

    fun getAllAttendance(): Flow<List<Attendance>> = universityDao.getAllAttendance()

    suspend fun insertAttendance(attendance: Attendance) = 
        universityDao.insertAttendance(attendance)

    suspend fun updateAttendance(attendance: Attendance) =
        universityDao.updateAttendance(attendance)

    suspend fun deleteAttendance(attendance: Attendance) =
        universityDao.deleteAttendance(attendance)

    // Assessments
    fun getAssessments(courseId: String): Flow<List<Assessment>> = 
        universityDao.getAssessmentsForCourse(courseId)

    fun getAllAssessments(): Flow<List<Assessment>> = universityDao.getAllAssessments()

    suspend fun insertAssessment(assessment: Assessment) = 
        universityDao.insertAssessment(assessment)

    // Payments
    fun getPayments(studentId: String): Flow<List<Payment>> = 
        universityDao.getPaymentsForStudent(studentId)

    fun getAllPayments(): Flow<List<Payment>> = universityDao.getAllPayments()

    suspend fun insertPayment(payment: Payment) = 
        universityDao.insertPayment(payment)

    // Timetable
    fun getTimetable(): Flow<List<TimetableEntry>> = universityDao.getAllTimetableEntries()

    fun getTimetableForStudent(studentId: String): Flow<List<TimetableEntry>> = 
        universityDao.getTimetableForStudent(studentId)

    suspend fun insertTimetableEntry(entry: TimetableEntry) = 
        universityDao.insertTimetableEntry(entry)

    suspend fun updateTimetableEntry(entry: TimetableEntry) =
        universityDao.updateTimetableEntry(entry)

    suspend fun deleteTimetableEntry(entry: TimetableEntry) =
        universityDao.deleteTimetableEntry(entry)

    // --- Legacy / Existing methods preserved ---
    fun getFeesForStudent(regNo: String): Flow<List<Fee>> = 
        universityDao.getFeesForStudent(regNo)

    fun getTotalOutstanding(regNo: String): Flow<Double?> = 
        universityDao.getTotalOutstandingAmount(regNo)

    fun getTimetableForDay(day: Int): Flow<List<TimeTableSlot>> = 
        universityDao.getTimeTableForDay(day)

    fun getAssignmentsByStatus(isSubmitted: Boolean): Flow<List<Assignment>> =
        universityDao.getAssignmentsByStatus(isSubmitted)

    suspend fun updateAssignment(assignment: Assignment) = 
        universityDao.updateAssignment(assignment)
}
