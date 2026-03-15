package com.querycubix.universityattendance.ui.feature.qr

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.querycubix.universityattendance.databinding.ActivitySelfieBinding
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.abs

class SelfieActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySelfieBinding
    private var imageCapture: ImageCapture? = null
    private lateinit var outputDirectory: File
    private lateinit var cameraExecutor: ExecutorService
    private var lastSavedUri: Uri? = null

    // Face Detection for Real-time Feedback
    private val faceDetector by lazy {
        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .build()
        FaceDetection.getClient(options)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySelfieBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, REQUEST_CODE_PERMISSIONS)
        }

        binding.btnCapture.setOnClickListener { takePhoto() }
        
        binding.btnRetake.setOnClickListener {
            resetUI()
        }

        binding.btnDone.setOnClickListener {
            lastSavedUri?.let { uri ->
                setResult(Activity.RESULT_OK, Intent().apply { data = uri })
            }
            finish()
        }

        outputDirectory = getOutputDirectory()
        cameraExecutor = Executors.newSingleThreadExecutor()
    }

    private fun resetUI() {
        binding.ivPreview.visibility = View.GONE
        binding.viewFinder.visibility = View.VISIBLE
        binding.faceOverlay.visibility = View.VISIBLE
        binding.tvGuidance.visibility = View.VISIBLE
        binding.btnCapture.visibility = View.VISIBLE
        binding.btnRetake.visibility = View.GONE
        binding.btnDone.visibility = View.GONE
        lastSavedUri = null
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.viewFinder.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            // Real-time analysis for the overlay feedback
            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture, imageAnalyzer)
            } catch (exc: Exception) {
                Log.e("SELFIE_DEBUG", "Use case binding failed", exc)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun processImageProxy(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            faceDetector.process(image)
                .addOnSuccessListener { faces ->
                    updateOverlay(faces, imageProxy.width, imageProxy.height)
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }

    private fun updateOverlay(faces: List<com.google.mlkit.vision.face.Face>, imgWidth: Int, imgHeight: Int) {
        if (faces.isEmpty()) {
            binding.faceOverlay.setFaceState(FaceOverlayView.FaceState.NO_FACE)
            binding.tvGuidance.text = "Align your face inside the frame"
            return
        }
        
        if (faces.size > 1) {
            binding.faceOverlay.setFaceState(FaceOverlayView.FaceState.INVALID)
            binding.tvGuidance.text = "Only one face allowed"
            return
        }

        val face = faces[0]
        
        // 1. Pose Check (Facing forward)
        val isFacingForward = abs(face.headEulerAngleY) < 15 && abs(face.headEulerAngleX) < 15
        
        // 2. Size Check (Close enough) - ML Kit uses image coordinates
        // For a 70% height oval, face should roughly be > 25% of image height
        val isCloseEnough = (face.boundingBox.height().toFloat() / imgHeight) > 0.25

        if (isFacingForward && isCloseEnough) {
            binding.faceOverlay.setFaceState(FaceOverlayView.FaceState.VALID)
            binding.tvGuidance.text = "Perfect! Hold still."
        } else {
            binding.faceOverlay.setFaceState(FaceOverlayView.FaceState.INVALID)
            binding.tvGuidance.text = if (!isFacingForward) "Face the camera directly" else "Move closer"
        }
    }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return
        val photoFile = File(outputDirectory, SimpleDateFormat(FILENAME_FORMAT, Locale.US).format(System.currentTimeMillis()) + ".jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        imageCapture.takePicture(outputOptions, ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
            override fun onError(exc: ImageCaptureException) {
                Toast.makeText(baseContext, "Capture failed", Toast.LENGTH_SHORT).show()
            }
            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                lastSavedUri = Uri.fromFile(photoFile)
                binding.ivPreview.setImageURI(lastSavedUri)
                binding.ivPreview.visibility = View.VISIBLE
                binding.viewFinder.visibility = View.GONE
                binding.faceOverlay.visibility = View.GONE
                binding.tvGuidance.visibility = View.GONE
                binding.btnCapture.visibility = View.GONE
                binding.btnRetake.visibility = View.VISIBLE
                binding.btnDone.visibility = View.VISIBLE
            }
        })
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun getOutputDirectory(): File {
        val mediaDir = externalMediaDirs.firstOrNull()?.let { File(it, "Selfies").apply { mkdirs() } }
        return if (mediaDir != null && mediaDir.exists()) mediaDir else filesDir
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        faceDetector.close()
    }

    companion object {
        private const val FILENAME_FORMAT = "yyyy-MM-dd-HH-mm-ss-SSS"
        private const val REQUEST_CODE_PERMISSIONS = 10
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_PERMISSIONS && allPermissionsGranted()) startCamera()
        else { finish() }
    }
}
