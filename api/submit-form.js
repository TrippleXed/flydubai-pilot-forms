const nodemailer = require('nodemailer');
const JSZip = require('jszip');
const fs = require('fs').promises;
const { jsPDF } = require('jspdf');

export default async function handler(req, res) {
  const submissionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`🆔 SUBMISSION ID: ${submissionId}`);
  
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
    console.log(`=== [${submissionId}] FORM SUBMISSION STARTED ===`);
    console.log(`[${submissionId}] Request method:`, req.method);
    console.log(`[${submissionId}] Content-Type:`, req.headers['content-type']);
    console.log(`[${submissionId}] Content-Length:`, req.headers['content-length']);
    console.log(`[${submissionId}] User-Agent:`, req.headers['user-agent']);
    console.log(`[${submissionId}] Timestamp:`, new Date().toISOString());
    
    // Parse multipart form data
    let formData;
    let files = {};
    
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Handle multipart form data with files
      const multer = require('multer');
      const upload = multer({ storage: multer.memoryStorage() });
      
      // Use multer to parse the multipart data
      await new Promise((resolve, reject) => {
        upload.any()(req, res, (err) => {
          if (err) return reject(err);
          
          // Parse form data from multipart with validation
          try {
            const formDataString = req.body.formData || '{}';
            console.log('Form data string length:', formDataString.length);
            formData = JSON.parse(formDataString);
            console.log('Parsed form data keys:', Object.keys(formData));
            
            // Validate required sections
            if (!formData.personalInfo) {
              throw new Error('Missing personal information');
            }
            
          } catch (parseError) {
            console.error('Error parsing form data:', parseError.message);
            throw new Error('Invalid form data format');
          }
          
          // Process uploaded files
          if (req.files) {
            console.log('Files received:', req.files.length);
            req.files.forEach(file => {
              console.log(`Processing file: ${file.fieldname} - ${file.originalname}`);
              files[file.fieldname] = {
                name: file.originalname,
                data: file.buffer,
                mimetype: file.mimetype
              };
            });
          } else {
            console.log('No files in request');
          }
          
          // Add files to formData for compatibility with existing code
          formData.uploads = files;
          console.log('Files added to formData.uploads:', Object.keys(files));
          
          resolve();
        });
      });
    } else {
      // Handle JSON form data (fallback)
      console.log('Using JSON fallback for form data');
      formData = req.body;
    }
    
    console.log('Final formData structure:', {
      personalInfo: !!formData.personalInfo,
      flightExperience: !!formData.flightExperience,
      documentation: !!formData.documentation,
      declaration: !!formData.declaration,
      uploads: formData.uploads ? Object.keys(formData.uploads) : 'none'
    });
    
    // Check required environment variables
    console.log(`[${submissionId}] Checking environment variables...`);
    const envCheck = {
      EMAIL_USER: !!process.env.EMAIL_USER,
      EMAIL_PASS: !!process.env.EMAIL_PASS,
      RECIPIENT_EMAIL: !!process.env.RECIPIENT_EMAIL,
      EMAIL_USER_VALUE: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}***@${process.env.EMAIL_USER.split('@')[1]}` : 'MISSING',
      RECIPIENT_EMAIL_VALUE: process.env.RECIPIENT_EMAIL || 'jason.cameron@flydubai.com'
    };
    
    console.log(`[${submissionId}] Environment variables:`, envCheck);
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(`[${submissionId}] ❌ CRITICAL: Missing email configuration:`, envCheck);
      return res.status(500).json({ 
        error: 'Email service not configured. Please contact administrator.',
        submissionId: submissionId
      });
    }
    
    console.log(`[${submissionId}] ✅ Environment variables validated`);

    // Create transporter
    console.log(`[${submissionId}] Creating nodemailer transporter...`);
    const transporterStartTime = Date.now();
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      debug: true, // Enable debug logging
      logger: true // Enable logger
    });
    
    console.log(`[${submissionId}] ✅ Email transporter created (${Date.now() - transporterStartTime}ms)`);
    
    // Test the connection
    console.log(`[${submissionId}] Testing email connection...`);
    const verifyStartTime = Date.now();
    
    try {
      await transporter.verify();
      console.log(`[${submissionId}] ✅ Email connection verified (${Date.now() - verifyStartTime}ms)`);
    } catch (verifyError) {
      console.error(`[${submissionId}] ❌ Email connection verification failed:`, {
        message: verifyError.message,
        code: verifyError.code,
        command: verifyError.command,
        response: verifyError.response,
        responseCode: verifyError.responseCode,
        duration: Date.now() - verifyStartTime
      });
      return res.status(500).json({ 
        error: 'Email service configuration error. Please check credentials.',
        submissionId: submissionId,
        details: verifyError.message
      });
    }

    // Create HTML email content from form data
    console.log(`[${submissionId}] Generating email content...`);
    const contentStartTime = Date.now();
    const emailContent = generateEmailContent(formData);
    console.log(`[${submissionId}] ✅ Email content generated (${Date.now() - contentStartTime}ms, ${emailContent.length} chars)`);

    // Create zip file with all attachments
    console.log(`[${submissionId}] Creating ZIP attachment...`);
    const zipStartTime = Date.now();
    const zipAttachment = await createZipAttachment(formData);
    console.log(`[${submissionId}] ${zipAttachment ? '✅' : '⚠️'} ZIP attachment ${zipAttachment ? 'created' : 'not created'} (${Date.now() - zipStartTime}ms)`);
    if (zipAttachment) {
      console.log(`[${submissionId}] ZIP size: ${(zipAttachment.content.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.RECIPIENT_EMAIL || 'jason.cameron@flydubai.com',
      subject: `Pilot Application - ${formData.pilotName || 'Pilot Submission'} - ${formData.applicationId || 'No ID'}`,
      html: emailContent,
      attachments: zipAttachment ? [zipAttachment] : [],
    };

    console.log(`[${submissionId}] 📧 ATTEMPTING EMAIL SEND...`);
    console.log(`[${submissionId}] Email details:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      hasAttachment: !!zipAttachment,
      attachmentSize: zipAttachment ? `${(zipAttachment.content.length / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      contentLength: `${(emailContent.length / 1024).toFixed(1)}KB`,
      timestamp: new Date().toISOString()
    });
    
    const sendStartTime = Date.now();
    
    try {
      const emailResult = await transporter.sendMail(mailOptions);
      const sendDuration = Date.now() - sendStartTime;
      
      console.log(`[${submissionId}] 🎉 EMAIL SENT SUCCESSFULLY! (${sendDuration}ms)`);
      console.log(`[${submissionId}] Email result:`, {
        messageId: emailResult.messageId,
        response: emailResult.response,
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
        pending: emailResult.pending,
        envelope: emailResult.envelope
      });
      
      // Additional verification
      if (emailResult.rejected && emailResult.rejected.length > 0) {
        console.warn(`[${submissionId}] ⚠️ Some recipients rejected:`, emailResult.rejected);
      }
      
      if (emailResult.pending && emailResult.pending.length > 0) {
        console.warn(`[${submissionId}] ⚠️ Some recipients pending:`, emailResult.pending);
      }
      
    } catch (sendError) {
      const sendDuration = Date.now() - sendStartTime;
      console.error(`[${submissionId}] ❌ EMAIL SEND FAILED! (${sendDuration}ms)`);
      console.error(`[${submissionId}] Send error details:`, {
        message: sendError.message,
        code: sendError.code,
        command: sendError.command,
        response: sendError.response,
        responseCode: sendError.responseCode,
        stack: sendError.stack
      });
      
      throw sendError; // Re-throw to be caught by outer try-catch
    }

    const response = { 
      success: true, 
      message: 'Form submitted successfully',
      emailId: emailResult.messageId,
      submissionId: submissionId,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[${submissionId}] ✅ SUBMISSION COMPLETE - sending success response:`, response);
    
    res.status(200).json(response);

  } catch (error) {
    console.error(`=== [${submissionId}] SUBMISSION ERROR ===`);
    console.error(`[${submissionId}] Error type:`, error.name);
    console.error(`[${submissionId}] Error message:`, error.message);
    console.error(`[${submissionId}] Error stack:`, error.stack);
    console.error(`[${submissionId}] Request info:`, {
      method: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      hasBody: !!req.body,
      hasFiles: !!(req.files && req.files.length > 0),
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit form. Please try again.';
    let errorCode = 500;
    
    if (error.message.includes('Request entity too large')) {
      errorMessage = 'Upload size too large. Please reduce file sizes and try again.';
      errorCode = 413;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Please try again with smaller files.';
      errorCode = 408;
    } else if (error.message.includes('JSON')) {
      errorMessage = 'Data format error. Please refresh the page and try again.';
      errorCode = 400;
    } else if (error.message.includes('auth') || error.message.includes('credential')) {
      errorMessage = 'Email service configuration error. Please contact support.';
      errorCode = 500;
    }
    
    res.status(errorCode).json({ 
      success: false, 
      error: errorMessage,
      details: error.message,
      submissionId: submissionId,
      timestamp: new Date().toISOString()
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

    // Generate comprehensive form data PDF
    const formDataPdf = await generateFormDataPDF(formData);
    if (formDataPdf) {
      zip.file('00_Application_Summary.pdf', formDataPdf);
      hasFiles = true;
      console.log('Added Application Summary PDF to zip');
    }

    // Add each uploaded file to the zip
    for (const [docId, folderName] of Object.entries(documentTypes)) {
      const fileData = formData.uploads[docId];
      
      if (fileData) {
        try {
          let fileBuffer;
          let fileName;
          
          if (fileData.filePath) {
            // Old format: read from file system
            fileBuffer = await fs.readFile(fileData.filePath);
            fileName = fileData.fileName;
          } else if (fileData.data) {
            // New format: file data is already in buffer
            fileBuffer = fileData.data;
            fileName = fileData.name;
          } else {
            console.log(`No valid file data for ${docId}`);
            continue;
          }
          
          // Get file extension from original filename
          const fileExtension = fileName.split('.').pop();
          const zipFileName = `${folderName}.${fileExtension}`;
          
          // Add file to zip
          zip.file(zipFileName, fileBuffer);
          hasFiles = true;
          
          console.log(`Added ${zipFileName} to zip`);
        } catch (fileError) {
          console.error(`Error processing file ${fileName}:`, fileError);
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

async function generateFormDataPDF(formData) {
  try {
    const doc = new jsPDF();
    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    
    // Helper function to add new page if needed
    const checkNewPage = (additionalHeight = 10) => {
      if (yPos + additionalHeight > pageHeight - margin) {
        doc.addPage();
        yPos = 20;
      }
    };
    
    // Helper function to add text with word wrap
    const addText = (text, x, y, options = {}) => {
      const maxWidth = options.maxWidth || 170;
      const fontSize = options.fontSize || 10;
      const fontStyle = options.fontStyle || 'normal';
      
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line, index) => {
        if (y + (index * 5) > pageHeight - margin) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, x, y + (index * 5));
      });
      
      return y + (lines.length * 5) + 2;
    };

    // Header
    doc.setFillColor(0, 122, 204);
    doc.rect(0, 0, 210, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('flydubai Pilot Application', 105, 20, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    yPos = 40;

    // Application ID and Date
    checkNewPage(15);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Application ID: ${formData.applicationId || 'Not Generated'}`, 20, yPos);
    yPos += 8;
    doc.text(`Submitted: ${formData.submittedAt ? new Date(formData.submittedAt).toLocaleString() : new Date().toLocaleString()}`, 20, yPos);
    yPos += 15;

    // Personal Information Section
    checkNewPage(60);
    doc.setFillColor(248, 250, 252);
    doc.rect(15, yPos - 5, 180, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('👤 Personal Information', 20, yPos);
    yPos += 15;

    const personalInfo = [
      ['Full Name', formData.pilotName || 'N/A'],
      ['Nationality', formData.nationality || 'N/A'], 
      ['Date of Birth', formData.dateOfBirth || 'N/A'],
      ['Email Address', formData.contactEmail || 'N/A'],
      ['Country Code', formData.countryCode || 'N/A'],
      ['Phone Number', formData.phoneNumber || 'N/A'],
      ['flydubai Designation', formData.designation || 'N/A'],
      ['Date of Joining', formData.doj || 'N/A']
    ];

    personalInfo.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${label}:`, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, yPos);
      yPos += 6;
    });
    
    yPos += 10;

    // Flight Experience Section
    checkNewPage(40);
    doc.setFillColor(240, 249, 255);
    doc.rect(15, yPos - 5, 180, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('✈️ Flight Experience Summary', 20, yPos);
    yPos += 15;

    // Grand Total
    checkNewPage(10);
    doc.setFillColor(240, 253, 244);
    doc.rect(15, yPos - 3, 180, 12, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Flight Hours: ${formData.grandTotalHours || 'Not Calculated'}`, 20, yPos + 5);
    yPos += 20;

    // Aircraft Type Details
    const flightData = [
      ['Boeing 737 NG/MAX Combined Hours', formData.b737_combined || 'N/A'],
      ['Boeing 737 NG/MAX Multi-Pilot Hours', formData.b737_mp || 'N/A'],
      ['Boeing 737 NG/MAX Night Hours', formData.b737_night || 'N/A'],
      ['Boeing 737 Classic Combined Hours', formData.b737c_combined || 'N/A'],
      ['Boeing 737 Classic Multi-Pilot Hours', formData.b737c_mp || 'N/A'],
      ['Boeing 737 Classic Night Hours', formData.b737c_night || 'N/A']
    ];

    flightData.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${label}:`, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 120, yPos);
      yPos += 6;
    });

    yPos += 10;

    // Documents Section
    checkNewPage(60);
    doc.setFillColor(254, 247, 237);
    doc.rect(15, yPos - 5, 180, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('📄 Document Checklist', 20, yPos);
    yPos += 15;

    const documentList = [
      ['Pilot License', 'pilotLicenseFile'],
      ['Medical Certificate', 'medicalFile'],
      ['Radio License', 'radioLicenseFile'],
      ['ROL Certificate', 'rolFile'],
      ['Flight Hours Verification', 'flightHoursFile'],
      ['Passport Copy', 'passportFile'],
      ['UAE Visa', 'visaFile'],
      ['License Verification Letter', 'licenseVerificationFile'],
      ['Hours Verification Letter', 'hoursVerificationFile'],
      ['No Incident Letter', 'incidentLetterFile'],
      ['Emirates ID', 'emiratesIdFile'],
      ['English Proficiency Certificate', 'englishFile']
    ];

    documentList.forEach(([docName, docId]) => {
      checkNewPage(8);
      const uploaded = formData.uploads && formData.uploads[docId];
      const status = uploaded ? '✅ Uploaded' : '❌ Missing';
      const fileName = uploaded ? uploaded.fileName : 'Not provided';
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${docName}:`, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(status, 120, yPos);
      if (uploaded) {
        doc.setFontSize(8);
        doc.setTextColor(108, 114, 128);
        doc.text(fileName, 20, yPos + 4);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
      }
      yPos += uploaded ? 10 : 6;
    });

    yPos += 10;

    // Declaration Section
    checkNewPage(30);
    doc.setFillColor(240, 253, 244);
    doc.rect(15, yPos - 5, 180, 8, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('✍️ Declaration & Signature', 20, yPos);
    yPos += 15;

    const declarationInfo = [
      ['Declaration Accepted', formData.declaration ? '✅ Yes' : '❌ No'],
      ['Signature Date', formData.signatureDate || 'N/A'],
      ['Digital Signature', formData.signaturePad ? '✅ Provided' : '❌ Missing'],
      ['Session ID', formData.sessionId || 'Not Available']
    ];

    declarationInfo.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${label}:`, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, yPos);
      yPos += 6;
    });

    // Footer
    checkNewPage(20);
    yPos = pageHeight - 30;
    doc.setFillColor(249, 250, 251);
    doc.rect(15, yPos - 5, 180, 25, 'F');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('This document was automatically generated from the flydubai Pilot Documentation System', 105, yPos + 5, { align: 'center' });
    doc.text('For queries regarding this application, please contact Flight Operations', 105, yPos + 10, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, yPos + 15, { align: 'center' });

    // Return PDF as buffer
    return Buffer.from(doc.output('arraybuffer'));
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
}