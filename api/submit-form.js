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
    const transporter = nodemailer.createTransport({
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
      to: process.env.RECIPIENT_EMAIL || 'jason.cameron@flydubai.com',
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
  const aircraftSections = formData.aircraftSections || [];
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(90deg, #3b82f6 0%, #f97316 50%, #3b82f6 100%); height: 4px; margin-bottom: 30px;"></div>
      
      <h1 style="color: #1e3a8a; margin-bottom: 30px;">Flight Time Experience Form Submission</h1>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #374151; margin-top: 0;">Personal Information</h2>
        <p><strong>Pilot Name:</strong> ${formData.pilotName || 'N/A'}</p>
        <p><strong>Designation:</strong> ${formData.designation || 'N/A'}</p>
        <p><strong>Date of Joining:</strong> ${formData.dateOfJoining || 'N/A'}</p>
        <p><strong>Signature Date:</strong> ${formData.signatureDate || 'N/A'}</p>
      </div>

      ${aircraftSections.length > 0 ? `
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #374151; margin-top: 0;">Aircraft Experience</h2>
        ${aircraftSections.map((section, index) => `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #d1d5db; border-radius: 8px; background: white;">
            <h3 style="color: #1e3a8a; margin-top: 0;">Aircraft Type ${index + 1}: ${section.aircraftType || 'Not specified'}</h3>
            ${Object.keys(section.flightData).length > 0 ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                ${Object.entries(section.flightData).map(([key, value]) => `
                  <p style="margin: 5px 0;"><strong>${key}:</strong> ${value}</p>
                `).join('')}
              </div>
            ` : '<p><em>No flight data entered for this aircraft type.</em></p>'}
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>Submitted on: ${new Date().toLocaleString()}</p>
        <p>This form was submitted through the flydubai pilot documentation system.</p>
        <p><strong>Note:</strong> This submission includes digital signature and declaration as per ICAO Annex 1 standards.</p>
      </div>
    </div>
  `;
}