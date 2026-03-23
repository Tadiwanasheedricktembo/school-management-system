package com.querycubix.universityattendance.ui.feature.qr

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import androidx.core.content.ContextCompat
import com.querycubix.universityattendance.R

class ScannerOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val backgroundPaint = Paint().apply {
        color = Color.parseColor("#99000000") // 60% opacity black
        style = Paint.Style.FILL
    }

    private val eraserPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
        isAntiAlias = true
    }

    private val borderPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 2f * resources.displayMetrics.density
        isAntiAlias = true
    }

    private val accentPaint = Paint().apply {
        color = Color.parseColor("#2563EB") // Primary Blue
        style = Paint.Style.STROKE
        strokeWidth = 4f * resources.displayMetrics.density
        strokeCap = Paint.Cap.ROUND
        isAntiAlias = true
    }

    private val linePaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private var scanLinePos = 0f
    private val frameRect = RectF()
    private var lineAnimator: ValueAnimator? = null
    private var pulseAnimator: ValueAnimator? = null
    private var pulseAlpha = 255
    private var isSuccess = false

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
        startAnimations()
    }

    private fun startAnimations() {
        lineAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1500
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
            interpolator = LinearInterpolator()
            addUpdateListener {
                scanLinePos = it.animatedValue as Float
                invalidate()
            }
            start()
        }

        pulseAnimator = ValueAnimator.ofInt(160, 255).apply {
            duration = 1000
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener {
                pulseAlpha = it.animatedValue as Int
                invalidate()
            }
            start()
        }
    }

    fun setSuccessState() {
        if (isSuccess) return
        isSuccess = true
        lineAnimator?.cancel()
        accentPaint.color = Color.parseColor("#10B981") // Success Green
        borderPaint.color = Color.parseColor("#10B981")
        invalidate()
        
        // Quick scale effect
        this.animate().scaleX(1.05f).scaleY(1.05f).setDuration(100).withEndAction {
            this.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
        }.start()
    }

    fun resetState() {
        isSuccess = false
        accentPaint.color = Color.parseColor("#2563EB")
        borderPaint.color = Color.WHITE
        if (lineAnimator?.isRunning == false) {
            lineAnimator?.start()
        }
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val layerId = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)

        // 1. Draw semi-transparent background
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        // 2. Calculate scan frame (70% width, centered)
        val size = width * 0.7f
        val left = (width - size) / 2
        val top = (height - size) / 2
        frameRect.set(left, top, left + size, top + size)

        val cornerRadius = 16f * resources.displayMetrics.density

        // 3. Clear the scan area
        canvas.drawRoundRect(frameRect, cornerRadius, cornerRadius, eraserPaint)

        // 4. Draw rounded white border
        canvas.drawRoundRect(frameRect, cornerRadius, cornerRadius, borderPaint)

        // 5. Draw accent corners with pulse effect
        drawAccentCorners(canvas, frameRect, cornerRadius)

        // 6. Draw animated scan line
        if (!isSuccess) {
            drawScanLine(canvas, frameRect)
        }

        canvas.restoreToCount(layerId)
    }

    private fun drawAccentCorners(canvas: Canvas, rect: RectF, radius: Float) {
        val len = 40f * resources.displayMetrics.density
        val thickness = accentPaint.strokeWidth
        
        accentPaint.alpha = pulseAlpha

        // Top Left
        canvas.drawLine(rect.left - thickness/2, rect.top + radius, rect.left - thickness/2, rect.top + len, accentPaint)
        canvas.drawLine(rect.left + radius, rect.top - thickness/2, rect.left + len, rect.top - thickness/2, accentPaint)
        val tlArc = RectF(rect.left - thickness/2, rect.top - thickness/2, rect.left + radius*2, rect.top + radius*2)
        canvas.drawArc(tlArc, 180f, 90f, false, accentPaint)

        // Top Right
        canvas.drawLine(rect.right + thickness/2, rect.top + radius, rect.right + thickness/2, rect.top + len, accentPaint)
        canvas.drawLine(rect.right - radius, rect.top - thickness/2, rect.right - len, rect.top - thickness/2, accentPaint)
        val trArc = RectF(rect.right - radius*2, rect.top - thickness/2, rect.right + thickness/2, rect.top + radius*2)
        canvas.drawArc(trArc, 270f, 90f, false, accentPaint)

        // Bottom Left
        canvas.drawLine(rect.left - thickness/2, rect.bottom - radius, rect.left - thickness/2, rect.bottom - len, accentPaint)
        canvas.drawLine(rect.left + radius, rect.bottom + thickness/2, rect.left + len, rect.bottom + thickness/2, accentPaint)
        val blArc = RectF(rect.left - thickness/2, rect.bottom - radius*2, rect.left + radius*2, rect.bottom + thickness/2)
        canvas.drawArc(blArc, 90f, 90f, false, accentPaint)

        // Bottom Right
        canvas.drawLine(rect.right + thickness/2, rect.bottom - radius, rect.right + thickness/2, rect.bottom - len, accentPaint)
        canvas.drawLine(rect.right - radius, rect.bottom + thickness/2, rect.right - len, rect.bottom + thickness/2, accentPaint)
        val brArc = RectF(rect.right - radius*2, rect.bottom - radius*2, rect.right + thickness/2, rect.bottom + thickness/2)
        canvas.drawArc(brArc, 0f, 90f, false, accentPaint)
    }

    private fun drawScanLine(canvas: Canvas, rect: RectF) {
        val y = rect.top + (rect.height() * scanLinePos)
        val lineHeight = 3f * resources.displayMetrics.density
        val margin = 12f * resources.displayMetrics.density
        
        val lineRect = RectF(rect.left + margin, y - lineHeight/2, rect.right - margin, y + lineHeight/2)
        
        val gradient = LinearGradient(
            rect.left, y, rect.right, y,
            intArrayOf(Color.TRANSPARENT, accentPaint.color, Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP
        )
        linePaint.shader = gradient
        canvas.drawRoundRect(lineRect, lineHeight/2, lineHeight/2, linePaint)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        lineAnimator?.cancel()
        pulseAnimator?.cancel()
    }
}
