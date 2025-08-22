const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const fs = require('fs').promises;

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

    // Create zip file with all attachments
    const zipAttachment = await createZipAttachment(formData);

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.RECIPIENT_EMAIL || 'jason.cameron@flydubai.com',
      subject: `Pilot Application - ${formData.pilotName || 'Pilot Submission'} - ${formData.applicationId || 'No ID'}`,
      html: emailContent,
      attachments: zipAttachment ? [zipAttachment] : [],
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
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #007acc 0%, #1a365d 100%); height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; border-radius: 12px;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">flydubai Pilot Application</h1>
      </div>
      
      <!-- Application ID -->
      <div style="background: #e6f3ff; border: 1px solid #007acc; border-radius: 8px; padding: 15px; margin-bottom: 25px; text-align: center;">
        <h2 style="margin: 0; color: #1a365d; font-size: 18px;">Application ID: ${formData.applicationId || 'Not Generated'}</h2>
        <p style="margin: 5px 0 0 0; color: #374151; font-size: 14px;">Submitted: ${formData.submittedAt ? new Date(formData.submittedAt).toLocaleString() : new Date().toLocaleString()}</p>
      </div>

      <!-- Personal Information -->
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007acc;">
        <h2 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">👤 Personal Information</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Full Name:</strong> ${formData.pilotName || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Nationality:</strong> ${formData.nationality || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Email:</strong> ${formData.contactEmail || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Phone:</strong> ${formData.phoneNumber || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Date of Birth:</strong> ${formData.dateOfBirth || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Designation:</strong> ${formData.designation || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Expected Date of Joining:</strong> ${formData.expectedDateOfJoining || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Previous Employer:</strong> ${formData.previousEmployer || 'N/A'}</p>
        </div>
      </div>

      <!-- Flight Experience -->
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
        <h2 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">✈️ Flight Experience</h2>
        <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px; text-align: center;">
          <h3 style="margin: 0; color: #16a34a; font-size: 20px;">Grand Total Flight Hours: ${formData.grandTotalHours || 'Not Calculated'}</h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Boeing 737 NG/MAX Hours:</strong> ${formData.b737_combined || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Multi-Pilot Hours:</strong> ${formData.b737_mp || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Night Hours:</strong> ${formData.b737_night || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Boeing 737 Classic Hours:</strong> ${formData.b737c_combined || 'N/A'}</p>
        </div>
      </div>

      <!-- Documentation -->
      <div style="background: #fef7ed; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f97316;">
        <h2 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">📄 Uploaded Documents</h2>
        <div style="background: #fff7ed; padding: 15px; border-radius: 6px; margin-bottom: 15px; text-align: center; border: 2px solid #f97316;">
          <h3 style="margin: 0 0 10px 0; color: #ea580c; font-size: 18px;">📦 All documents attached as ZIP file</h3>
          <p style="margin: 0; color: #7c2d12; font-size: 14px;">Download and extract the attached ZIP file to access all uploaded documents</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          ${generateDocumentStatus(formData.uploads, 'pilotLicenseFile', 'Pilot License')}
          ${generateDocumentStatus(formData.uploads, 'medicalFile', 'Medical Certificate')}
          ${generateDocumentStatus(formData.uploads, 'radioLicenseFile', 'Radio License')}
          ${generateDocumentStatus(formData.uploads, 'rolFile', 'ROL Certificate')}
          ${generateDocumentStatus(formData.uploads, 'flightHoursFile', 'Flight Hours Verification')}
          ${generateDocumentStatus(formData.uploads, 'passportFile', 'Passport Copy')}
          ${generateDocumentStatus(formData.uploads, 'visaFile', 'UAE Visa')}
          ${generateDocumentStatus(formData.uploads, 'licenseVerificationFile', 'License Verification Letter')}
          ${generateDocumentStatus(formData.uploads, 'hoursVerificationFile', 'Hours Verification Letter')}
          ${generateDocumentStatus(formData.uploads, 'incidentLetterFile', 'No Incident Letter')}
          ${generateDocumentStatus(formData.uploads, 'emiratesIdFile', 'Emirates ID')}
          ${generateDocumentStatus(formData.uploads, 'englishFile', 'English Proficiency Certificate')}
        </div>
      </div>

      <!-- Declaration & Signature -->
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
        <h2 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">✍️ Declaration & Signature</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Declaration Accepted:</strong> ${formData.declaration ? '✅ Yes' : '❌ No'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Signature Date:</strong> ${formData.signatureDate || 'N/A'}</p>
          <p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>Digital Signature:</strong> ${formData.signaturePad ? '✅ Provided' : '❌ Missing'}</p>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; padding: 20px; border-top: 2px solid #e5e7eb; background: #f9fafb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h3 style="color: #1a365d; margin: 0;">flydubai Flight Operations</h3>
          <p style="color: #6b7280; margin: 5px 0; font-size: 14px;">This is an automated submission from the Pilot Documentation System</p>
        </div>
        <div style="text-align: center; font-size: 12px; color: #6b7280;">
          <p style="margin: 5px 0;">✅ Declaration completed per ICAO Annex 1 standards and UAE GCAA regulations</p>
          <p style="margin: 5px 0;">📧 For queries regarding this application, please contact Flight Operations</p>
          <p style="margin: 5px 0;">🔗 Session ID: ${formData.sessionId || 'Not Available'}</p>
        </div>
      </div>
    </div>
  `;
}

function generateDocumentStatus(uploads, docId, docName) {
  const doc = uploads && uploads[docId];
  const status = doc ? '✅ Uploaded' : '❌ Missing';
  const fileName = doc ? doc.fileName : 'Not uploaded';
  const size = doc ? `(${(doc.size / 1024).toFixed(1)}KB)` : '';
  
  return `<p style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px;"><strong>${docName}:</strong> ${status}<br><span style="font-size: 12px; color: #6b7280;">${fileName} ${size}</span></p>`;
}

async function createZipAttachment(formData) {
  try {
    if (!formData.uploads || Object.keys(formData.uploads).length === 0) {
      console.log('No uploaded files found');
      return null;
    }

    const zip = new JSZip();
    let hasFiles = false;

    // Document types and their folder names in the zip
    const documentTypes = {
      pilotLicenseFile: 'Pilot_License',
      medicalFile: 'Medical_Certificate', 
      radioLicenseFile: 'Radio_License',
      rolFile: 'ROL_Certificate',
      flightHoursFile: 'Flight_Hours_Verification',
      passportFile: 'Passport',
      visaFile: 'UAE_Visa',
      licenseVerificationFile: 'License_Verification_Letter',
      hoursVerificationFile: 'Hours_Verification_Letter', 
      incidentLetterFile: 'No_Incident_Letter',
      emiratesIdFile: 'Emirates_ID',
      englishFile: 'English_Proficiency_Certificate'
    };

    // Add each uploaded file to the zip
    for (const [docId, folderName] of Object.entries(documentTypes)) {
      const fileData = formData.uploads[docId];
      
      if (fileData && fileData.filePath) {
        try {
          // Read the file from the file system
          const fileBuffer = await fs.readFile(fileData.filePath);
          
          // Get file extension from original filename
          const fileExtension = fileData.fileName.split('.').pop();
          const zipFileName = `${folderName}.${fileExtension}`;
          
          // Add file to zip
          zip.file(zipFileName, fileBuffer);
          hasFiles = true;
          
          console.log(`Added ${zipFileName} to zip`);
        } catch (fileError) {
          console.error(`Error reading file ${fileData.fileName}:`, fileError);
        }
      }
    }

    if (!hasFiles) {
      console.log('No valid files to zip');
      return null;
    }

    // Generate the zip file buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Create attachment object for nodemailer
    const applicationId = formData.applicationId || 'Unknown';
    const pilotName = (formData.pilotName || 'Pilot').replace(/[^a-zA-Z0-9]/g, '_');
    const zipFileName = `${pilotName}_${applicationId}_Documents.zip`;

    return {
      filename: zipFileName,
      content: zipBuffer,
      contentType: 'application/zip'
    };

  } catch (error) {
    console.error('Error creating zip file:', error);
    return null;
  }
}