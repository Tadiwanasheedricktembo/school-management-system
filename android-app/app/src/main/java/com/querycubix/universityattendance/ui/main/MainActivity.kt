package com.querycubix.universityattendance.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.querycubix.universityattendance.R
import com.querycubix.universityattendance.UniversityApplication
import com.querycubix.universityattendance.data.remote.AttendanceApiService
import com.querycubix.universityattendance.data.repository.AttendanceRepository
import com.querycubix.universityattendance.databinding.ActivityMainBinding
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceState
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceViewModel
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceViewModelFactory
import com.querycubix.universityattendance.ui.feature.qr.SelfieActivity
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.ByteArrayOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: QrAttendanceViewModel
    private val app by lazy { application as UniversityApplication }
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    private val qrScannerLauncher: ActivityResultLauncher<ScanOptions> =
        registerForActivityResult(ScanContract()) { result ->
            val token = result.contents
            val rollNumber = binding.etRollNumber.text.toString().trim()
            val deviceId = getUniqueDeviceId()
            
            if (token != null) {
                // Remember roll number for next time
                app.session.lastRollNumber = rollNumber
                
                Log.d("ATTENDANCE_DEBUG", "Initiating submission from UI")
                
                // Final check for metadata before submission
                Log.d("ATTENDANCE_DEBUG", "Roll: $rollNumber, Token: $token")
                Log.d("ATTENDANCE_DEBUG", "Selfie in VM: ${if (viewModel.capturedSelfieBase64 != null) "PRESENT (len: ${viewModel.capturedSelfieBase64?.length})" else "MISSING"}")
                Log.d("ATTENDANCE_DEBUG", "Location in VM: Lat=${viewModel.capturedLatitude}, Lon=${viewModel.capturedLongitude}")

                if (viewModel.capturedLatitude == null || viewModel.capturedLongitude == null) {
                    Log.w("ATTENDANCE_DEBUG", "Submitting without location. This might be rejected by backend.")
                }

                // Submit attendance with all captured data
                viewModel.markAttendance(
                    rollNumber = rollNumber,
                    token = token,
                    deviceId = deviceId,
                    latitude = viewModel.capturedLatitude,
                    longitude = viewModel.capturedLongitude,
                    selfie = viewModel.capturedSelfieBase64
                )
            } else {
                Log.d("QR_DEBUG", "Scan cancelled or failed")
                Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show()
            }
        }

    private val selfieLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val selfieUri = result.data?.data
            if (selfieUri != null) {
                Log.d("SELFIE_DEBUG", "Received selfie URI: $selfieUri")
                binding.cvSelfiePreview.visibility = View.VISIBLE
                binding.ivSelfiePreview.setImageURI(selfieUri)
                
                // Convert to Base64 and save to ViewModel state
                val base64 = uriToBase64(selfieUri)
                if (base64 != null) {
                    viewModel.capturedSelfieBase64 = base64
                    Log.d("SELFIE_DEBUG", "Selfie successfully converted and saved to ViewModel. Length: ${base64.length}")
                } else {
                    Log.e("SELFIE_DEBUG", "Failed to convert selfie URI to Base64 string")
                }
                
                Toast.makeText(this, "Selfie captured successfully", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        when {
            permissions.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false) -> {
                Log.d("LOCATION_DEBUG", "Fine location permission granted")
                fetchLocation()
            }
            permissions.getOrDefault(Manifest.permission.ACCESS_COARSE_LOCATION, false) -> {
                Log.d("LOCATION_DEBUG", "Coarse location permission granted")
                fetchLocation()
            }
            else -> {
                Log.d("LOCATION_DEBUG", "Location permission denied")
                Toast.makeText(this, "Location permission required", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        setupViewModel()
        setupUI()
        setupListeners()
        observeViewModel()

        // Auto-fetch location on start if permission exists
        if (hasLocationPermission()) {
            fetchLocation()
        }
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun setupUI() {
        // Pre-fill last used roll number
        binding.etRollNumber.setText(app.session.lastRollNumber)
    }

    private fun setupViewModel() {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl("http://192.168.65.237:3000/api/") 
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val apiService = retrofit.create(AttendanceApiService::class.java)
        val repository = AttendanceRepository(apiService)
        
        val factory = QrAttendanceViewModelFactory(repository)
        viewModel = ViewModelProvider(this, factory)[QrAttendanceViewModel::class.java]
    }

    private fun setupListeners() {
        binding.btnScanQr.setOnClickListener {
            val rollNumber = binding.etRollNumber.text.toString().trim()
            if (rollNumber.isEmpty()) {
                binding.tilRollNumber.error = getString(R.string.error_empty_roll)
                return@setOnClickListener
            }
            binding.tilRollNumber.error = null

            // Ensure location is available before scan (Requirement 1 & 4)
            if (viewModel.capturedLatitude == null || viewModel.capturedLongitude == null) {
                Log.d("LOCATION_DEBUG", "Scan attempted without location. Requesting update.")
                Toast.makeText(this, "Location required. Please fetch location first.", Toast.LENGTH_LONG).show()
                checkLocationPermissions()
                return@setOnClickListener
            }

            val options = ScanOptions()
            options.setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            options.setPrompt(getString(R.string.scan_qr_prompt))
            options.setBeepEnabled(true)
            options.setOrientationLocked(false)
            qrScannerLauncher.launch(options)
        }

        binding.btnTakeSelfie.setOnClickListener {
            Log.d("SELFIE_DEBUG", "Take Selfie button clicked")
            val intent = Intent(this, SelfieActivity::class.java)
            selfieLauncher.launch(intent)
        }

        binding.btnGetLocation.setOnClickListener {
            Log.d("LOCATION_DEBUG", "Location button clicked")
            checkLocationPermissions()
        }
    }

    private fun checkLocationPermissions() {
        if (hasLocationPermission()) {
            fetchLocation()
        } else {
            locationPermissionLauncher.launch(arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ))
        }
    }

    @SuppressLint("MissingPermission")
    private fun fetchLocation() {
        Log.d("LOCATION_DEBUG", "Fetching current location...")
        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            if (location != null) {
                // Save to ViewModel state
                viewModel.capturedLatitude = location.latitude
                viewModel.capturedLongitude = location.longitude
                
                Log.d("LOCATION_DEBUG", "Location saved to ViewModel: Lat: ${location.latitude}, Lon: ${location.longitude}")
                binding.cvLocationInfo.visibility = View.VISIBLE
                binding.tvLocationPreview.text = "Lat: ${location.latitude}\nLon: ${location.longitude}"
                Toast.makeText(this, "Location fetched successfully", Toast.LENGTH_SHORT).show()
            } else {
                Log.d("LOCATION_DEBUG", "Location is null")
                Toast.makeText(this, "Could not fetch location. Is GPS enabled?", Toast.LENGTH_SHORT).show()
            }
        }.addOnFailureListener { e ->
            Log.e("LOCATION_DEBUG", "Location fetch failed", e)
            Toast.makeText(this, "Error fetching location", Toast.LENGTH_SHORT).show()
        }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is QrAttendanceState.Idle -> {
                            setLoading(false)
                            binding.tvStatus.text = getString(R.string.scan_prompt)
                            binding.tvStatus.setTextColor(getColor(android.R.color.darker_gray))
                        }
                        is QrAttendanceState.Loading -> {
                            setLoading(true)
                            binding.tvStatus.text = getString(R.string.submitting_attendance)
                            binding.tvStatus.setTextColor(getColor(android.R.color.black))
                        }
                        is QrAttendanceState.Success -> {
                            setLoading(false)
                            binding.tvStatus.text = state.message
                            binding.tvStatus.setTextColor(getColor(android.R.color.holo_green_dark))
                            Toast.makeText(this@MainActivity, state.message, Toast.LENGTH_LONG).show()
                            
                            // Clear state after success to ensure next session is fresh
                            viewModel.resetState()
                            binding.cvSelfiePreview.visibility = View.GONE
                            binding.cvLocationInfo.visibility = View.GONE
                        }
                        is QrAttendanceState.Error -> {
                            setLoading(false)
                            binding.tvStatus.text = state.message
                            binding.tvStatus.setTextColor(getColor(android.R.color.holo_red_dark))
                            Toast.makeText(this@MainActivity, state.message, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.btnScanQr.isEnabled = !isLoading
        binding.btnTakeSelfie.isEnabled = !isLoading
        binding.btnGetLocation.isEnabled = !isLoading
        binding.tilRollNumber.isEnabled = !isLoading
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        if (isLoading) {
            binding.btnScanQr.text = ""
        } else {
            binding.btnScanQr.text = getString(R.string.scan_qr_code)
        }
    }

    @SuppressLint("HardwareIds")
    private fun getUniqueDeviceId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_device"
    }

    private fun uriToBase64(uri: Uri): String? {
        return try {
            val inputStream = contentResolver.openInputStream(uri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            if (bitmap == null) {
                Log.e("SELFIE_DEBUG", "Failed to decode bitmap from URI: $uri")
                return null
            }
            val outputStream = ByteArrayOutputStream()
            // Using 50% quality to reduce payload size as base64 can be very large
            bitmap.compress(Bitmap.CompressFormat.JPEG, 50, outputStream)
            val byteArray = outputStream.toByteArray()
            Base64.encodeToString(byteArray, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e("SELFIE_DEBUG", "Error converting URI to Base64", e)
            null
        }
    }
}
