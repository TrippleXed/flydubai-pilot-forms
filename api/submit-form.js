const nodemailer = require('nodemailer');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = req.body;
    
    // Create transporter (you'll need to add these environment variables)
    const transporter = nodemailer.createTransporter({
      service: 'gmail', // or your preferred email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // App password for Gmail
      },
    });

    // Create HTML email content from form data
    const emailContent = generateEmailContent(formData);

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.RECIPIENT_EMAIL || 'hr.documentation@flydubai.com',
      subject: `Flight Time Experience Form - ${formData.pilotName || 'Pilot Submission'}`,
      html: emailContent,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      message: 'Form submitted successfully' 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit form. Please try again.' 
    });
  }
}

function generateEmailContent(formData) {
  const flightHours = formData.flightHours || {};
  const experience = formData.experience || {};
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(90deg, #3b82f6 0%, #f97316 50%, #3b82f6 100%); height: 4px; margin-bottom: 30px;"></div>
      
      <h1 style="color: #1e3a8a; margin-bottom: 30px;">Flight Time Experience Form Submission</h1>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #374151; margin-top: 0;">Personal Information</h2>
        <p><strong>Pilot Name:</strong> ${formData.pilotName || 'N/A'}</p>
        <p><strong>Employee ID:</strong> ${formData.employeeId || 'N/A'}</p>
        <p><strong>License Number:</strong> ${formData.licenseNumber || 'N/A'}</p>
        <p><strong>Email:</strong> ${formData.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${formData.phone || 'N/A'}</p>
      </div>

      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #374151; margin-top: 0;">Flight Hours Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #e5e7eb;">
            <th style="padding: 8px; text-align: left; border: 1px solid #d1d5db;">Aircraft Type</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #d1d5db;">Total Hours</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #d1d5db;">PIC Hours</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #d1d5db;">SIC Hours</th>
          </tr>
          ${Object.entries(flightHours).map(([aircraft, hours]) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #d1d5db;">${aircraft}</td>
              <td style="padding: 8px; border: 1px solid #d1d5db;">${hours.total || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #d1d5db;">${hours.pic || 'N/A'}</td>
              <td style="padding: 8px; border: 1px solid #d1d5db;">${hours.sic || 'N/A'}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #374151; margin-top: 0;">Additional Information</h2>
        <p><strong>Previous Airlines:</strong> ${formData.previousAirlines || 'N/A'}</p>
        <p><strong>Certifications:</strong> ${formData.certifications || 'N/A'}</p>
        <p><strong>Remarks:</strong> ${formData.remarks || 'N/A'}</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>Submitted on: ${new Date().toLocaleString()}</p>
        <p>This form was submitted through the flydubai pilot documentation system.</p>
      </div>
    </div>
  `;
}