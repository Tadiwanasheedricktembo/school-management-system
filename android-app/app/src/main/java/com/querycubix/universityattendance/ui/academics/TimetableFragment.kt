package com.querycubix.universityattendance.ui.academics

import android.app.TimePickerDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.querycubix.universityattendance.UniversityApplication
import com.querycubix.universityattendance.data.model.TimetableEntry
import com.querycubix.universityattendance.databinding.DialogAddTimetableBinding
import com.querycubix.universityattendance.databinding.FragmentTimetableBinding
import com.querycubix.universityattendance.ui.feature.timetable.TimetableAdapter
import com.querycubix.universityattendance.ui.feature.timetable.TimetableViewModel
import com.querycubix.universityattendance.ui.feature.timetable.TimetableViewModelFactory
import kotlinx.coroutines.launch
import java.util.*

class TimetableFragment : Fragment() {

    private var _binding: FragmentTimetableBinding? = null
    private val binding get() = _binding!!

    private val viewModel: TimetableViewModel by viewModels {
        val app = requireActivity().application as UniversityApplication
        TimetableViewModelFactory(app.repository, app.session.userPrn)
    }

    private lateinit var adapter: TimetableAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTimetableBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        adapter = TimetableAdapter(
            onEditClick = { entry -> showEditTimetableDialog(entry) },
            onDeleteClick = { entry -> showDeleteConfirmation(entry) }
        )
        binding.rvTimetable.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@TimetableFragment.adapter
        }
    }

    private fun setupListeners() {
        binding.fabAddTimetable.setOnClickListener {
            showAddTimetableDialog()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    adapter.submitList(state.timetableList)
                    binding.tvEmpty.visibility = if (state.timetableList.isEmpty()) View.VISIBLE else View.GONE
                }
            }
        }
    }

    private fun showAddTimetableDialog() {
        showTimetableDialog(null)
    }

    private fun showEditTimetableDialog(entry: TimetableEntry) {
        showTimetableDialog(entry)
    }

    private fun showTimetableDialog(existingEntry: TimetableEntry?) {
        val dialogBinding = DialogAddTimetableBinding.inflate(layoutInflater)
        val days = arrayOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
        
        // Setup Day Spinner
        val daySpinnerAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, days)
        daySpinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        dialogBinding.spinnerDay.adapter = daySpinnerAdapter

        // Setup Course Spinner
        val courses = viewModel.uiState.value.courses
        val courseCodes = courses.map { it.courseCode }
        val courseSpinnerAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, courseCodes)
        courseSpinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        dialogBinding.spinnerCourse.adapter = courseSpinnerAdapter

        // Pre-fill if editing
        existingEntry?.let { entry ->
            val courseIndex = courseCodes.indexOf(entry.courseCode)
            if (courseIndex >= 0) dialogBinding.spinnerCourse.setSelection(courseIndex)
            
            dialogBinding.etProfessor.setText(entry.professor)
            dialogBinding.etStartTime.setText(entry.startTime)
            dialogBinding.etEndTime.setText(entry.endTime)
            dialogBinding.etRoom.setText(entry.room)
            dialogBinding.spinnerDay.setSelection(entry.dayOfWeek - 1)
        }

        dialogBinding.etStartTime.setOnClickListener {
            showTimePicker { time -> dialogBinding.etStartTime.setText(time) }
        }

        dialogBinding.etEndTime.setOnClickListener {
            showTimePicker { time -> dialogBinding.etEndTime.setText(time) }
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle(if (existingEntry == null) "Add Class" else "Edit Class")
            .setView(dialogBinding.root)
            .setPositiveButton("Save") { _, _ ->
                val courseCode = dialogBinding.spinnerCourse.selectedItem?.toString() ?: ""
                val professor = dialogBinding.etProfessor.text.toString()
                val startTime = dialogBinding.etStartTime.text.toString()
                val endTime = dialogBinding.etEndTime.text.toString()
                val room = dialogBinding.etRoom.text.toString()
                val dayOfWeek = dialogBinding.spinnerDay.selectedItemPosition + 1

                if (courseCode.isBlank() || startTime.isBlank() || endTime.isBlank()) {
                    Toast.makeText(context, "Please fill required fields", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val entry = TimetableEntry(
                    id = existingEntry?.id ?: 0,
                    courseCode = courseCode,
                    dayOfWeek = dayOfWeek,
                    startTime = startTime,
                    endTime = endTime,
                    room = room,
                    professor = professor
                )

                if (existingEntry == null) {
                    viewModel.addTimetableEntry(entry)
                } else {
                    viewModel.updateTimetableEntry(entry)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showTimePicker(onTimeSelected: (String) -> Unit) {
        val calendar = Calendar.getInstance()
        TimePickerDialog(requireContext(), { _, hour, minute ->
            onTimeSelected(String.format(Locale.getDefault(), "%02d:%02d", hour, minute))
        }, calendar.get(Calendar.HOUR_OF_DAY), calendar.get(Calendar.MINUTE), true).show()
    }

    private fun showDeleteConfirmation(entry: TimetableEntry) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Delete Class")
            .setMessage("Remove ${entry.courseCode} from timetable?")
            .setPositiveButton("Delete") { _, _ ->
                viewModel.deleteTimetableEntry(entry)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
