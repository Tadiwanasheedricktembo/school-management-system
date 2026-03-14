package com.querycubix.universityattendance.ui.academics

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.querycubix.universityattendance.UniversityApplication
import com.querycubix.universityattendance.data.model.Attendance
import com.querycubix.universityattendance.databinding.FragmentAttendanceBinding
import com.querycubix.universityattendance.ui.feature.attendance.AttendanceAdapter
import com.querycubix.universityattendance.ui.feature.attendance.AttendanceViewModel
import com.querycubix.universityattendance.ui.feature.attendance.AttendanceViewModelFactory
import kotlinx.coroutines.launch
import java.util.*

class AttendanceFragment : Fragment() {

    private var _binding: FragmentAttendanceBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AttendanceViewModel by viewModels {
        val app = requireActivity().application as UniversityApplication
        AttendanceViewModelFactory(app.repository, app.session.userPrn)
    }

    private lateinit var adapter: AttendanceAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAttendanceBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        adapter = AttendanceAdapter(
            onEditClick = { attendance -> showEditAttendanceDialog(attendance) },
            onDeleteClick = { attendance -> showDeleteConfirmation(attendance) }
        )
        binding.rvAttendance.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@AttendanceFragment.adapter
        }
    }

    private fun setupListeners() {
        binding.fabAddAttendance.setOnClickListener {
            showAddAttendanceDialog()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    adapter.submitList(state.attendanceList)
                    
                    binding.tvAttendancePercentage.text = String.format(Locale.getDefault(), "%.1f%%", state.attendancePercentage)
                    binding.tvPresentCount.text = "Present: ${state.presentCount}"
                    binding.tvTotalClasses.text = "Total Classes: ${state.totalCount}"
                    
                    binding.tvEmpty.visibility = if (state.attendanceList.isEmpty()) View.VISIBLE else View.GONE
                }
            }
        }
    }

    private fun showAddAttendanceDialog() {
        val statuses = arrayOf("Present", "Absent", "Late")
        var selectedStatus = statuses[0]

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Add Attendance")
            .setSingleChoiceItems(statuses, 0) { _, which ->
                selectedStatus = statuses[which]
            }
            .setPositiveButton("Add") { _, _ ->
                viewModel.addAttendance("CS101", selectedStatus)
                Toast.makeText(context, "Attendance added", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showEditAttendanceDialog(attendance: Attendance) {
        val statuses = arrayOf("Present", "Absent", "Late")
        val currentIndex = statuses.indexOf(attendance.status)

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Edit Attendance")
            .setSingleChoiceItems(statuses, currentIndex) { _, which ->
                val updatedAttendance = attendance.copy(status = statuses[which])
                viewModel.updateAttendance(updatedAttendance)
            }
            .setPositiveButton("Done", null)
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showDeleteConfirmation(attendance: Attendance) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Delete Record")
            .setMessage("Are you sure you want to delete this attendance record?")
            .setPositiveButton("Delete") { _, _ ->
                viewModel.deleteAttendance(attendance)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
