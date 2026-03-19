package com.querycubix.universityattendance.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
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
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.querycubix.universityattendance.R
import com.querycubix.universityattendance.UniversityApplication
import com.querycubix.universityattendance.data.remote.AttendanceApiService
import com.querycubix.universityattendance.data.remote.NetworkConfig
import com.querycubix.universityattendance.data.repository.AttendanceRepository
import com.querycubix.universityattendance.databinding.ActivityMainBinding
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceState
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceViewModel
import com.querycubix.universityattendance.ui.feature.qr.QrAttendanceViewModelFactory
import com.querycubix.universityattendance.ui.feature.qr.SelfieActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.ByteArrayOutputStream
import java.util.Locale
import kotlin.math.abs

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: QrAttendanceViewModel
    private val app by lazy { application as UniversityApplication }
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    
    private var lastScanClickTime: Long = 0

    private val qrScannerLauncher: ActivityResultLauncher<ScanOptions> =
        registerForActivityResult(ScanContract()) { result ->
            val token = result.contents
            val studentName = binding.etStudentName.text.toString().trim()
            val rollNumber = binding.etRollNumber.text.toString().trim()
            val deviceId = getUniqueDeviceId()
            
            if (token != null) {
                app.session.lastRollNumber = rollNumber
                viewModel.markAttendance(
                    studentName = studentName,
                    rollNumber = rollNumber,
                    token = token,
                    deviceId = deviceId,
                    latitude = viewModel.capturedLatitude,
                    longitude = viewModel.capturedLongitude,
                    selfie = viewModel.capturedSelfieBase64
                )
            } else {
                Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show()
            }
        }

    private val selfieLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val selfieUri = result.data?.data
            if (selfieUri != null) {
                processSelfie(selfieUri)
            }
        }
    }

    private fun processSelfie(uri: Uri) {
        lifecycleScope.launch {
            binding.progressBar.visibility = View.VISIBLE
            binding.btnTakeSelfie.isEnabled = false
            
            val validationResult = withContext(Dispatchers.Default) { validateSelfieContent(uri) }
            
            if (validationResult == "OK") {
                binding.cvSelfiePreview.visibility = View.VISIBLE
                binding.ivSelfiePreview.setImageURI(uri)
                
                val base64 = withContext(Dispatchers.IO) { uriToBase64(uri) }
                if (base64 != null) {
                    viewModel.capturedSelfieBase64 = base64
                    updateReadinessUI()
                    Toast.makeText(this@MainActivity, "Selfie processed successfully", Toast.LENGTH_SHORT).show()
                }
            } else {
                viewModel.capturedSelfieBase64 = null
                binding.cvSelfiePreview.visibility = View.GONE
                updateReadinessUI()
                Toast.makeText(this@MainActivity, validationResult, Toast.LENGTH_LONG).show()
            }
            
            binding.progressBar.visibility = View.GONE
            binding.btnTakeSelfie.isEnabled = true
        }
    }

    private suspend fun validateSelfieContent(uri: Uri): String {
        return try {
            val image = InputImage.fromFilePath(this, uri)
            val options = FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
                .build()
            
            val detector = FaceDetection.getClient(options)
            val faces = detector.process(image).await()

            if (faces.isEmpty()) return "No face detected. Please retake."
            if (faces.size > 1) return "Multiple faces detected. Only one person allowed."

            val face = faces[0]
            
            if (abs(face.headEulerAngleY) > 15) return "Look directly at the camera (too much turn)."
            if (abs(face.headEulerAngleX) > 15) return "Look directly at the camera (too much tilt)."

            val faceWidth = face.boundingBox.width()
            val imageWidth = image.width
            val sizeRatio = faceWidth.toFloat() / imageWidth.toFloat()
            if (sizeRatio < 0.20) return "Face too far away. Move closer."

            "OK"
        } catch (e: Exception) {
            Log.e("FACE_DETECTION", "Error validating face", e)
            "Error validating selfie."
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        when {
            permissions.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false) ||
            permissions.getOrDefault(Manifest.permission.ACCESS_COARSE_LOCATION, false) -> fetchLocation()
            else -> Toast.makeText(this, "Location permission required", Toast.LENGTH_SHORT).show()
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
        if (hasLocationPermission()) fetchLocation()
        updateReadinessUI()
    }

    override fun onResume() {
        super.onResume()
        updateReadinessUI()
        if (hasLocationPermission() && isLocationEnabled()) {
            if (viewModel.capturedLatitude == null) fetchLocation()
        }
    }

    private fun setupUI() {
        binding.etRollNumber.setText(app.session.lastRollNumber)
        
        val commonTextWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { 
                binding.tilRollNumber.error = null
                binding.tilStudentName.error = null
                updateReadinessUI() 
            }
            override fun afterTextChanged(s: Editable?) {}
        }

        binding.etStudentName.addTextChangedListener(commonTextWatcher)
        binding.etRollNumber.addTextChangedListener(commonTextWatcher)
    }

    private fun isLocationEnabled(): Boolean {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
               locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    private fun updateReadinessUI() {
        val hasName = binding.etStudentName.text.toString().trim().isNotEmpty()
        val hasRoll = binding.etRollNumber.text.toString().trim().isNotEmpty()
        val hasLocation = viewModel.capturedLatitude != null && isLocationEnabled()
        val hasSelfie = viewModel.capturedSelfieBase64 != null

        // Selfie Status
        if (hasSelfie) {
            binding.tvSelfieStatus.text = "Captured"
            binding.tvSelfieStatus.setTextColor(getColor(R.color.success))
            binding.tvSelfieStatus.setBackgroundResource(android.R.drawable.editbox_background)
            binding.tvSelfieStatus.backgroundTintList = android.content.res.ColorStateList.valueOf(getColor(R.color.success_light))
        } else {
            binding.tvSelfieStatus.text = "Required"
            binding.tvSelfieStatus.setTextColor(getColor(R.color.text_secondary))
            binding.tvSelfieStatus.setBackgroundResource(android.R.drawable.editbox_background)
            binding.tvSelfieStatus.backgroundTintList = null
        }

        // Location Status
        if (hasLocation) {
            binding.tvLocationStatus.text = "Available"
            binding.tvLocationStatus.setTextColor(getColor(R.color.success))
            binding.tvLocationStatus.setBackgroundResource(android.R.drawable.editbox_background)
            binding.tvLocationStatus.backgroundTintList = android.content.res.ColorStateList.valueOf(getColor(R.color.success_light))
            binding.layoutLocationInfo.visibility = View.VISIBLE
        } else {
            binding.tvLocationStatus.text = "Required"
            binding.tvLocationStatus.setTextColor(getColor(R.color.text_secondary))
            binding.tvLocationStatus.setBackgroundResource(android.R.drawable.editbox_background)
            binding.tvLocationStatus.backgroundTintList = null
            binding.layoutLocationInfo.visibility = View.GONE
        }

        // Action Readiness
        val isReady = hasName && hasRoll && hasLocation && hasSelfie
        binding.btnScanQr.isEnabled = isReady
        binding.btnScanQr.alpha = if (isReady) 1.0f else 0.6f
        
        if (isReady) {
            binding.tvStatus.text = "READY TO SCAN"
            binding.tvStatus.setTextColor(getColor(R.color.success))
        } else {
            val statusText = when {
                !hasName -> "Enter student name"
                !hasRoll -> "Enter roll number"
                !hasSelfie -> "Selfie required"
                !hasLocation -> "Location required"
                else -> "Verification pending"
            }
            binding.tvStatus.text = statusText.uppercase()
            binding.tvStatus.setTextColor(getColor(R.color.text_secondary))
        }
    }

    private fun setupListeners() {
        binding.btnScanQr.setOnClickListener {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastScanClickTime < 1000) return@setOnClickListener
            lastScanClickTime = currentTime
            
            qrScannerLauncher.launch(ScanOptions().apply {
                setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                setPrompt("Align QR code to mark attendance")
                setBeepEnabled(true)
                setOrientationLocked(false)
            })
        }
        binding.btnTakeSelfie.setOnClickListener { selfieLauncher.launch(Intent(this, SelfieActivity::class.java)) }
        binding.btnGetLocation.setOnClickListener { checkLocationPermissions() }
    }

    @SuppressLint("MissingPermission")
    private fun fetchLocation() {
        if (!isLocationEnabled()) {
            Toast.makeText(this, "Please enable location services", Toast.LENGTH_SHORT).show()
            startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            return
        }
        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            if (location != null) {
                viewModel.capturedLatitude = location.latitude
                viewModel.capturedLongitude = location.longitude
                binding.tvLocationPreview.text = "Location Available"
                updateReadinessUI()
            } else {
                Toast.makeText(this, "Location identification failed. Try again.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is QrAttendanceState.Idle -> { setLoading(false); updateReadinessUI() }
                        is QrAttendanceState.Loading -> setLoading(true)
                        is QrAttendanceState.Success -> {
                            setLoading(false)
                            binding.tvStatus.text = "ATTENDANCE SUBMITTED"
                            binding.tvStatus.setTextColor(getColor(R.color.success))
                            viewModel.resetState()
                            binding.cvSelfiePreview.visibility = View.GONE
                            viewModel.capturedSelfieBase64 = null
                            updateReadinessUI()
                        }
                        is QrAttendanceState.Error -> { 
                            setLoading(false)
                            binding.tvStatus.text = "SUBMISSION FAILED"
                            binding.tvStatus.setTextColor(getColor(R.color.error))
                            Toast.makeText(this@MainActivity, state.message, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
        }
    }

    private fun hasLocationPermission() = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun checkLocationPermissions() {
        if (hasLocationPermission()) fetchLocation()
        else locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }

    private fun setLoading(isLoading: Boolean) {
        binding.btnScanQr.isEnabled = !isLoading
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        if (isLoading) {
            binding.tvStatus.text = "PROCESSING..."
            binding.tvStatus.setTextColor(getColor(R.color.primary))
        }
    }

    private fun setupViewModel() {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
        val client = OkHttpClient.Builder().addInterceptor(logging).build()
        val retrofit = Retrofit.Builder()
            .baseUrl(NetworkConfig.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val apiService = retrofit.create(AttendanceApiService::class.java)
        val repository = AttendanceRepository(apiService)
        val factory = QrAttendanceViewModelFactory(repository)
        viewModel = ViewModelProvider(this, factory)[QrAttendanceViewModel::class.java]
    }

    @SuppressLint("HardwareIds")
    private fun getUniqueDeviceId(): String = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"

    private fun uriToBase64(uri: Uri): String? {
        return try {
            val options = BitmapFactory.Options().apply { inSampleSize = 4 }
            val bitmap = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) } ?: return null
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 40, outputStream)
            val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
            bitmap.recycle()
            base64
        } catch (e: Exception) { null }
    }
}
