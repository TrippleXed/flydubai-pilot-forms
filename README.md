# flydubai Pilot Forms

Professional web-based forms for flydubai pilot documentation and flight time experience submission.

## 🛩️ Forms Available

### 1. Flight Time Experience Form
- Dynamic flight hour calculations across multiple aircraft types
- Real-time totals for PIC (Pilot in Command) and SIC (Second in Command) hours
- Professional flydubai branding and styling
- Digital signature capabilities

### 2. Pilot Documentation Form  
- Comprehensive pilot information collection
- License and certification management
- Medical certificate tracking
- Document upload functionality

## 🚀 Deployment

This project is deployed on Vercel with serverless backend functionality.

**Live URL**: [Your Vercel URL will be here]

## ✨ Features

- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Calculations**: Automatic totals and validations
- **Email Integration**: Automatic form submission to HR via email
- **Professional Branding**: flydubai colors, logo, and styling
- **Secure Submission**: Server-side form processing with validation
- **No Dependencies**: Self-contained forms with embedded assets

## 🛠️ Technical Stack

- **Frontend**: Pure HTML, CSS, and JavaScript
- **Backend**: Vercel Serverless Functions (Node.js)
- **Email**: Nodemailer with Gmail integration
- **Deployment**: Vercel Platform
- **Styling**: Custom CSS with flydubai brand colors

## 📧 Email Configuration

The forms automatically send submissions to: `hr.documentation@flydubai.com`

### Environment Variables Required:
- `EMAIL_USER`: Gmail address for sending emails
- `EMAIL_PASS`: Gmail app password (16-character token)
- `RECIPIENT_EMAIL`: Destination email for form submissions

## 🔧 Development

```bash
# Install dependencies
npm install

# Start local development
vercel dev

# Deploy to production  
vercel --prod
```

## 📝 Usage

1. **For Pilots**: Click the form link → Fill out details → Submit
2. **For HR**: Receive formatted email with all pilot information
3. **For IT**: Monitor submissions through Vercel dashboard

## 🎨 Customization

- Colors defined in CSS custom properties using flydubai brand guidelines
- Logo embedded as base64 for maximum portability
- Responsive grid layouts for professional appearance
- Form validations ensure data quality

## 📱 Mobile Support

Fully responsive design optimized for:
- Desktop browsers
- iPad/tablet devices  
- Mobile phones
- Various screen orientations

## 🔒 Security

- Server-side form validation
- Environment variable protection for credentials
- CORS headers properly configured
- Input sanitization for email content

---

**© 2024 flydubai - Pilot Documentation System**