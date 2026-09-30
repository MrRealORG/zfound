package com.zfound.mobile

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.zfound.mobile.databinding.ActivityMainBinding
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Main Camera Activity for ZFound Mobile.
 * Captures photos and immediately transfers them to the PC over local Wi-Fi.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: PreferencesManager
    private val networkClient = NetworkClient()
    private lateinit var cameraExecutor: ExecutorService

    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
    private var isFlashOn = false
    private var isUploading = false

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startCamera()
        } else {
            Toast.makeText(this, R.string.camera_permission_required, Toast.LENGTH_LONG).show()
        }
    }

    private val qrScannerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            checkPcConnection()
        }
    }

    private val galleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            uploadImageUri(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = PreferencesManager(this)
        cameraExecutor = Executors.newSingleThreadExecutor()

        setupControls()

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    override fun onResume() {
        super.onResume()
        checkPcConnection()
    }

    private fun allPermissionsGranted(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun setupControls() {
        // Shutter Button Click
        binding.btnCapture.setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            takePhotoAndUpload()
        }

        // Switch Camera (Front / Back)
        binding.btnSwitchCamera.setOnClickListener {
            cameraSelector = if (cameraSelector == CameraSelector.DEFAULT_BACK_CAMERA) {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }
            isFlashOn = false
            updateFlashIcon()
            startCamera()
        }

        // Flashlight Toggle
        binding.btnFlash.setOnClickListener {
            toggleFlash()
        }

        // QR Scanner Button
        binding.btnScanQr.setOnClickListener {
            openQrScanner()
        }

        // Top Status Badge (Click to reconnect or rescan)
        binding.btnConnectionStatus.setOnClickListener {
            openQrScanner()
        }

        // Pick Photo from Gallery
        binding.btnGallery.setOnClickListener {
            galleryLauncher.launch("image/*")
        }
    }

    private fun openQrScanner() {
        val intent = Intent(this, QrScannerActivity::class.java)
        qrScannerLauncher.launch(intent)
    }

    private fun toggleFlash() {
        val cam = camera ?: return
        if (!cam.cameraInfo.hasFlashUnit()) {
            Toast.makeText(this, "No flash unit on this lens", Toast.LENGTH_SHORT).show()
            return
        }

        isFlashOn = !isFlashOn
        cam.cameraControl.enableTorch(isFlashOn)
        updateFlashIcon()
    }

    private fun updateFlashIcon() {
        if (isFlashOn) {
            binding.btnFlash.setImageResource(R.drawable.ic_flash_on)
        } else {
            binding.btnFlash.setImageResource(R.drawable.ic_flash_off)
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(binding.viewFinder.surfaceProvider)
                }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .setTargetRotation(binding.viewFinder.display?.rotation ?: 0)
                .build()

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageCapture
                )
            } catch (exc: Exception) {
                Toast.makeText(this, "Failed to initialize camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun triggerShutterAnimation() {
        binding.flashOverlay.visibility = View.VISIBLE
        binding.flashOverlay.alpha = 0.8f
        binding.flashOverlay.animate()
            .alpha(0f)
            .setDuration(150)
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    binding.flashOverlay.visibility = View.GONE
                }
            })
    }

    private fun takePhotoAndUpload() {
        if (isUploading) {
            Toast.makeText(this, "Previous photo is transferring...", Toast.LENGTH_SHORT).show()
            return
        }

        val config = prefs.getConnectionConfig()
        if (!config.isValid) {
            Toast.makeText(this, "Please scan the PC QR code first!", Toast.LENGTH_LONG).show()
            openQrScanner()
            return
        }

        val imgCapture = imageCapture ?: return
        triggerShutterAnimation()

        val photoFile = File(cacheDir, "zfound_${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        showToastBanner("Capturing...", inProgress = true)

        imgCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    dispatchUpload(photoFile)
                }

                override fun onError(exception: ImageCaptureException) {
                    hideToastBanner()
                    Toast.makeText(
                        this@MainActivity,
                        "Capture error: ${exception.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        )
    }

    private fun uploadImageUri(uri: Uri) {
        val config = prefs.getConnectionConfig()
        if (!config.isValid) {
            Toast.makeText(this, "Please scan the PC QR code first!", Toast.LENGTH_LONG).show()
            openQrScanner()
            return
        }

        showToastBanner("Preparing photo...", inProgress = true)
        lifecycleScope.launch {
            try {
                val tempFile = File(cacheDir, "gallery_${System.currentTimeMillis()}.jpg")
                contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        input.copyTo(output)
                    }
                }
                dispatchUpload(tempFile)
            } catch (e: Exception) {
                hideToastBanner()
                Toast.makeText(this@MainActivity, "Failed to read image: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun dispatchUpload(photoFile: File) {
        val config = prefs.getConnectionConfig()
        isUploading = true
        showToastBanner("Transferring to PC...", inProgress = true)

        lifecycleScope.launch {
            val result = networkClient.uploadPhoto(
                config = config,
                photoFile = photoFile,
                deviceName = prefs.deviceName
            )

            isUploading = false
            photoFile.delete() // Clean up temp file

            result.onSuccess { uploadRes ->
                val countText = if (uploadRes.productCount > 0) {
                    " (${uploadRes.productCount} products found!)"
                } else ""
                showToastBanner("Sent to PC!$countText", inProgress = false)

                binding.toastBanner.postDelayed({
                    hideToastBanner()
                }, 3000)
            }.onFailure { error ->
                showToastBanner("Transfer failed: ${error.message}", inProgress = false)
                binding.toastBanner.postDelayed({
                    hideToastBanner()
                }, 4000)
            }
        }
    }

    private fun checkPcConnection() {
        val config = prefs.getConnectionConfig()
        if (!config.isValid) {
            updateStatusUi(isConnected = false, text = getString(R.string.status_disconnected))
            return
        }

        lifecycleScope.launch {
            val result = networkClient.checkStatus(config)
            result.onSuccess { status ->
                updateStatusUi(isConnected = true, text = status.pcName ?: "PC Connected")
            }.onFailure {
                updateStatusUi(isConnected = false, text = "PC Unreachable")
            }
        }
    }

    private fun updateStatusUi(isConnected: Boolean, text: String) {
        binding.txtStatus.text = text
        val dotColor = if (isConnected) {
            ContextCompat.getColor(this, R.color.success)
        } else {
            ContextCompat.getColor(this, R.color.error)
        }
        binding.statusDot.backgroundTintList = android.content.res.ColorStateList.valueOf(dotColor)
    }

    private fun showToastBanner(message: String, inProgress: Boolean) {
        binding.toastBanner.visibility = View.VISIBLE
        binding.txtToast.text = message
        binding.toastProgress.visibility = if (inProgress) View.VISIBLE else View.GONE
    }

    private fun hideToastBanner() {
        binding.toastBanner.visibility = View.GONE
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
