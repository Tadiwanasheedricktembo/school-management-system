const db = require('../config/database');
const AnomalyDetector = require('../services/anomalyDetector');

class AnomalyController {
  // Get anomalies with filtering
  static getAnomalies(req, res) {
    const { session_id, severity, review_status, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT
        a.*,
        s.course_name,
        s.class_name,
        s.session_date,
        s.start_time,
        s.end_time,
        st.name as student_name
      FROM attendance a
      LEFT JOIN sessions s ON a.session_id = s.id
      LEFT JOIN students st ON a.student_id = st.student_id
      WHERE a.anomaly_score > 0
    `;

    const params = [];
    const conditions = [];

    if (session_id) {
      conditions.push('a.session_id = ?');
      params.push(session_id);
    }

    if (severity && severity !== 'all') {
      conditions.push('a.anomaly_severity = ?');
      params.push(severity);
    }

    if (review_status && review_status !== 'all') {
      conditions.push('a.anomaly_review_status = ?');
      params.push(review_status);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY a.anomaly_score DESC, a.scan_time DESC';

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching anomalies:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch anomalies'
        });
      }

      // Get total count for pagination
      let countSql = `
        SELECT COUNT(*) as total
        FROM attendance a
        WHERE a.anomaly_score > 0
      `;

      if (conditions.length > 0) {
        countSql += ' AND ' + conditions.join(' AND ');
      }

      db.get(countSql, params.slice(0, -2), (err, countResult) => {
        if (err) {
          console.error('Error counting anomalies:', err);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to count anomalies'
          });
        }

        // Enhance anomaly data with descriptions
        const enhancedRows = rows.map(row => ({
          ...row,
          anomaly_descriptions: row.anomaly_flags ?
            row.anomaly_flags.split(',').map(flag => ({
              flag,
              description: AnomalyDetector.getAnomalyDescription(flag.trim())
            })) : [],
          severity_color: AnomalyDetector.getSeverityColor(row.anomaly_severity)
        }));

        res.json({
          status: 'success',
          data: enhancedRows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            pages: Math.ceil(countResult.total / parseInt(limit))
          }
        });
      });
    });
  }

  // Get anomalies for a specific session
  static getSessionAnomalies(req, res) {
    const { session_id } = req.params;

    if (!session_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required'
      });
    }

    const sql = `
      SELECT
        a.*,
        s.course_name,
        s.class_name,
        s.session_date,
        st.name as student_name
      FROM attendance a
      LEFT JOIN sessions s ON a.session_id = s.id
      LEFT JOIN students st ON a.student_id = st.student_id
      WHERE a.session_id = ? AND a.anomaly_score > 0
      ORDER BY a.anomaly_score DESC, a.scan_time DESC
    `;

    db.all(sql, [session_id], (err, rows) => {
      if (err) {
        console.error('Error fetching session anomalies:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch session anomalies'
        });
      }

      // Enhance anomaly data
      const enhancedRows = rows.map(row => ({
        ...row,
        anomaly_descriptions: row.anomaly_flags ?
          row.anomaly_flags.split(',').map(flag => ({
            flag,
            description: AnomalyDetector.getAnomalyDescription(flag.trim())
          })) : [],
        severity_color: AnomalyDetector.getSeverityColor(row.anomaly_severity)
      }));

      res.json({
        status: 'success',
        data: enhancedRows
      });
    });
  }

  // Update anomaly review status
  static updateAnomalyReview(req, res) {
    const { id } = req.params;
    const { review_status, notes } = req.body;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Anomaly ID is required'
      });
    }

    if (!['pending', 'approved', 'flagged'].includes(review_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid review status. Must be pending, approved, or flagged'
      });
    }

    const sql = `
      UPDATE attendance
      SET anomaly_review_status = ?, anomaly_notes = ?
      WHERE id = ?
    `;

    db.run(sql, [review_status, notes || '', id], function(err) {
      if (err) {
        console.error('Error updating anomaly review:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update anomaly review'
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Anomaly not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Anomaly review updated successfully'
      });
    });
  }

  // Get anomaly statistics
  static getAnomalyStats(req, res) {
    const sql = `
      SELECT
        COUNT(*) as total_anomalies,
        SUM(CASE WHEN anomaly_severity = 'high' THEN 1 ELSE 0 END) as high_severity,
        SUM(CASE WHEN anomaly_severity = 'medium' THEN 1 ELSE 0 END) as medium_severity,
        SUM(CASE WHEN anomaly_severity = 'low' THEN 1 ELSE 0 END) as low_severity,
        SUM(CASE WHEN anomaly_review_status = 'pending' THEN 1 ELSE 0 END) as pending_review,
        SUM(CASE WHEN anomaly_review_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN anomaly_review_status = 'flagged' THEN 1 ELSE 0 END) as flagged
      FROM attendance
      WHERE anomaly_score > 0
    `;

    db.get(sql, [], (err, stats) => {
      if (err) {
        console.error('Error fetching anomaly stats:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch anomaly statistics'
        });
      }

      res.json({
        status: 'success',
        data: stats
      });
    });
  }

  // Bulk update anomaly reviews
  static bulkUpdateAnomalyReviews(req, res) {
    const { anomaly_ids, review_status, notes } = req.body;

    if (!Array.isArray(anomaly_ids) || anomaly_ids.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Anomaly IDs array is required'
      });
    }

    if (!['pending', 'approved', 'flagged'].includes(review_status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid review status'
      });
    }

    const placeholders = anomaly_ids.map(() => '?').join(',');
    const sql = `
      UPDATE attendance
      SET anomaly_review_status = ?, anomaly_notes = ?
      WHERE id IN (${placeholders})
    `;

    const params = [review_status, notes || '', ...anomaly_ids];

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error bulk updating anomalies:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to bulk update anomalies'
        });
      }

      res.json({
        status: 'success',
        message: `${this.changes} anomalies updated successfully`
      });
    });
  }
}

module.exports = AnomalyController;</content>
<parameter name="filePath">c:\Users\tadiw\Desktop\ATTENDANCE SYSTEM\web-version\server\controllers\anomalyController.js