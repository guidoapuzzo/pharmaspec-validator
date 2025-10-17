# PharmaSpec Validator - User Guide for Engineers

This guide explains how to use PharmaSpec Validator for GxP-compliant requirements traceability and validation documentation.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Dashboard](#understanding-the-dashboard)
3. [Managing Projects](#managing-projects)
4. [Working with Requirements](#working-with-requirements)
5. [Document Management](#document-management)
6. [Traceability Matrix](#traceability-matrix)
7. [Compliance and Audit](#compliance-and-audit)
8. [Data Export](#data-export)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Application

1. Connect to your company VPN
2. Open a web browser (Chrome, Firefox, or Edge recommended)
3. Navigate to the application URL provided by your administrator
4. You'll see the login page

### First Login

1. Enter your email and password (provided by your administrator)
2. Click "Sign In"
3. **Important**: Change your password immediately after first login

### User Roles

PharmaSpec Validator has three user roles:

- **Admin**: Full access to all features, user management, audit trails
- **Engineer**: Create/edit projects, manage requirements, generate matrices
- **Viewer**: Read-only access to projects and documentation

---

## Understanding the Dashboard

After logging in, you'll see the main dashboard with:

### Navigation Bar
- **PharmaSpec Validator**: Logo, click to return to dashboard
- **Dashboard**: View all active projects
- **Archived Projects**: View archived projects
- **User Management**: (Admin only) Manage users
- **Logout**: Sign out of the application

### Project Cards

Each project card shows:
- **Project Name**: Click to open project details
- **Description**: Brief project description
- **Status**: Current project phase (planning, active, completed)
- **Documents**: Number of uploaded documents
- **Requirements**: Number of defined requirements
- **Matrix Entries**: Number of traceability matrix entries
- **Created**: Project creation date
- **Actions**: Edit, Archive, Delete buttons

---

## Managing Projects

### Creating a New Project

1. Click **"+ New Project"** button on the dashboard
2. Fill in the project details:
   - **Name**: Short, descriptive project name (e.g., "PLC-001 Validation")
   - **Description**: Detailed project description
   - **Status**: Select project phase
     - **Planning**: Requirements gathering phase
     - **Active**: Active validation work
     - **Completed**: Validation complete
3. Click **"Create Project"**

### Editing a Project

1. Click **Edit** button on project card
2. Modify project details
3. Click **"Save Changes"**

### Archiving a Project

1. Click **Archive** button on project card
2. Confirm archival
3. Archived projects move to "Archived Projects" section
4. To view: Click **"Archived Projects"** in navigation

### Deleting a Project

**Warning**: Deletion is permanent and removes all associated data!

1. Click **Delete** button on project card
2. Type project name to confirm
3. Click **"Delete"** to confirm

---

## Working with Requirements

Requirements are the specifications or test cases you need to verify.

### Adding a Requirement

1. Open a project
2. Click **"+ Add Requirement"** button
3. Fill in requirement details:
   - **Identifier**: Unique ID (e.g., "REQ-001", "TS-042")
   - **Description**: What needs to be verified
   - **Category**: Type of requirement
     - **Functional**: Feature or function requirements
     - **Performance**: Speed, capacity, efficiency requirements
     - **Safety**: Safety-critical requirements
     - **Compliance**: Regulatory compliance requirements
   - **Priority**: Importance level
     - **High**: Critical path, safety-critical
     - **Medium**: Important but not critical
     - **Low**: Nice-to-have features
4. Click **"Add Requirement"**

**Note**: New requirements automatically start with "In Progress" status.

### Requirement Status Workflow

Requirements follow this lifecycle:

1. **In Progress** (default): Requirement is being tested/validated
2. **Completed**: Click **"✓ Complete"** when validation is done
3. **Reopen**: Click **"↺ Reopen"** if you need to revise or retest

### Editing a Requirement

1. Click **Edit** button next to the requirement
2. Modify details
3. Click **"Save Changes"**

### Deleting a Requirement

1. Click **Delete** button next to the requirement
2. Confirm deletion
3. **Note**: This also deletes associated matrix entries

---

## Document Management

Documents contain the specifications, test results, or evidence you're validating against.

### Supported File Formats

- **PDF** (.pdf): Specification documents, test reports
- **Word** (.docx): Requirements documents, protocols
- **Excel** (.xlsx): Test data, matrices, tables

**File Size Limit**: 50MB per file (configurable by administrator)

### Uploading Documents

1. Open a project
2. Click **"Upload Documents"** button
3. Click **"Choose Files"** or drag-and-drop files
4. Select one or more files
5. Click **"Upload"**

### Document Processing

After upload, documents are automatically analyzed:

1. **Processing**: AI extracts content and structure
   - Status shows "Processing..." with spinner
   - Processing time: 30 seconds to 5 minutes (depends on document size and complexity)
   - Dashboard automatically refreshes when complete

2. **Completed**: Extraction finished successfully
   - Status shows "Completed" with green checkmark
   - Model used (e.g., "gemini-2.5-flash" or "gemini-2.5-pro")
   - You can now analyze requirements against this document

3. **Failed**: Processing encountered an error
   - Status shows "Failed" with error details
   - Try re-uploading or contact administrator

### Viewing Documents

1. Click **View** button next to a document
2. Shows metadata:
   - Filename, size, upload date
   - Extraction status and model used
   - Extracted content preview

### Deleting Documents

1. Click **Delete** button next to a document
2. Confirm deletion
3. **Note**: This also deletes associated matrix entries

---

## Traceability Matrix

The traceability matrix links requirements to documentary evidence.

### What is the Traceability Matrix?

The matrix shows:
- Which requirements have been verified
- What documentary evidence supports each requirement
- Compliance status (pass/fail/partial)
- AI-generated rationale for each determination

### Generating Matrix Entries

#### Option 1: Analyze All Documents for One Requirement

1. Open a project
2. Locate the requirement in the requirements list
3. Click **"Analyze Document"** button for that requirement
4. Select which documents to analyze
5. Click **"Analyze"**

The system will:
- Analyze the requirement against each selected document
- Create a separate matrix entry for each requirement-document pair
- Extract relevant sections from documents
- Determine compliance status
- Generate reasoning

#### Option 2: Bulk Analysis

1. Click **"Analyze All"** button (if available)
2. System analyzes all requirements against all documents
3. **Note**: This can take significant time for large projects

### Understanding Matrix Entries

Each matrix entry shows:

- **Requirement**: The requirement being verified (ID and description)
- **Document**: The document providing evidence (filename)
- **Compliance Status**:
  - **✓ Pass**: Requirement fully met by document
  - **✗ Fail**: Requirement not met or contradicted
  - **⚠ Partial**: Requirement partially met or unclear
- **Rationale**: AI-generated explanation of the determination
- **Evidence**: Relevant excerpts from the document

### Viewing Matrix Entry Details

1. Click **View** button in the matrix table
2. Modal shows:
   - Full requirement details
   - Document information
   - Complete compliance rationale
   - All extracted evidence
   - AI model used for analysis
   - Timestamp of analysis

### Editing Matrix Entries

Engineers can refine AI-generated assessments:

1. Click **Edit** button in the matrix table
2. Modal shows requirement and document (read-only)
3. Editable fields:
   - **Compliance Status**: Change pass/fail/partial
   - **Rationale**: Revise or add to AI explanation
   - **Evidence**: Add additional supporting text
4. Click **"Save Changes"**

**Best Practice**: Document why you changed the AI's assessment in the rationale.

### Multiple Entries per Requirement

You can test the same requirement against multiple documents:

- Each requirement-document pair creates a separate matrix entry
- Useful when requirement spans multiple specification documents
- Example: Test case "REQ-001" verified against:
  - "Functional Spec.pdf" → Pass
  - "Test Results.xlsx" → Pass
  - "User Manual.docx" → Partial

### Deleting Matrix Entries

1. Click **Delete** button in the matrix table
2. Confirm deletion
3. Matrix entry is removed (does not affect requirement or document)

---

## Compliance and Audit

PharmaSpec Validator is designed for GxP compliance with full audit trails.

### Audit Trail

Every action is logged:
- User who performed the action
- What was changed
- When it occurred
- Previous and new values

#### Viewing Audit Trail (Admin Only)

1. Click **"Audit Trail"** button in User Management
2. Filter by:
   - User
   - Action type (create, update, delete)
   - Date range
3. View detailed change history

### Electronic Signatures

For regulatory compliance, certain actions require electronic signatures:

- Marking requirements as complete
- Finalizing projects
- Approving validation documentation

When prompted:
1. Enter your password to sign
2. System records your signature with timestamp

**Note**: Electronic signature requirements are configurable by administrator.

### Data Retention

- **Documents and Projects**: Retained for 90 days after deletion (configurable)
- **Audit Logs**: Retained for 7 years (GxP requirement)
- **Backups**: Performed daily by system administrator

---

## Data Export

### Exporting Traceability Matrix

Export the full matrix to CSV for:
- Integration with other tools
- Regulatory submissions
- Offline review

1. Open a project
2. Scroll to the Traceability Matrix section
3. Click **"Export Matrix to CSV"** button
4. File downloads automatically

**CSV Columns**:
- Requirement ID
- Requirement Description
- Requirement Category
- Requirement Priority
- Document Name (filename)
- Compliance Status
- Rationale
- Evidence
- Created Date
- Last Updated

### Opening CSV Files

- **Excel**: Open directly, all formatting preserved
- **Google Sheets**: Import as CSV
- **Text Editor**: View raw data

---

## Best Practices

### Project Organization

1. **One Project per Validation**: Keep validation activities separate
2. **Descriptive Names**: Use clear project names (e.g., "Autoclave-201 IQ/OQ")
3. **Status Updates**: Keep project status current (planning → active → completed)

### Requirements Writing

1. **Unique Identifiers**: Use consistent numbering (REQ-001, REQ-002...)
2. **Clear Descriptions**: Write specific, testable requirements
3. **Proper Categorization**: Use correct category and priority
4. **Granularity**: Break complex requirements into smaller, testable units

### Document Upload

1. **Quality Sources**: Upload complete, final versions of documents
2. **File Naming**: Use descriptive filenames (avoid "document1.pdf")
3. **Wait for Processing**: Let extraction complete before analyzing
4. **Check Status**: Verify "Completed" status before proceeding

### Matrix Analysis

1. **Incremental Analysis**: Analyze documents as they're uploaded
2. **Review AI Output**: Always review AI-generated entries
3. **Add Context**: Enhance rationale with your engineering judgment
4. **Multiple Documents**: Test requirements against all relevant documents
5. **Regular Updates**: Reanalyze if documents are revised

### Compliance

1. **Document Everything**: Use rationale field to explain decisions
2. **Electronic Signatures**: Sign off on completed validations
3. **Review Audit Trail**: Periodically review changes (admins)
4. **Backup Exports**: Keep CSV exports for records

---

## Troubleshooting

### Login Issues

**Problem**: Cannot log in
- Verify VPN connection is active
- Check email and password spelling
- Contact administrator to reset password
- Clear browser cache and cookies

### Document Upload Fails

**Problem**: Upload button doesn't work or shows error
- Check file size (must be under 50MB)
- Verify file format (PDF, DOCX, or XLSX only)
- Try a different browser
- Check network connection

### Document Processing Stuck

**Problem**: Document shows "Processing" for a long time
- Large documents can take up to 5 minutes
- Dashboard automatically refreshes every 5 seconds
- If stuck for >10 minutes, contact administrator
- Check document isn't corrupted (try opening locally)

### Matrix Analysis Errors

**Problem**: "Analyze Document" fails
- Ensure document processing is complete (status: "Completed")
- Verify document isn't empty or corrupted
- Check that requirement has a description
- Try analyzing one document at a time
- If error persists, contact administrator

### Slow Performance

**Problem**: Application is slow or unresponsive
- Close unused browser tabs
- Clear browser cache
- Check VPN connection speed
- Avoid bulk operations during peak hours
- Contact administrator if persistent

### Missing Data

**Problem**: Projects or documents disappeared
- Check "Archived Projects" section
- Verify you're logged in with correct account
- Ask colleagues if project was deleted
- Contact administrator to check audit trail

---

## Getting Help

### In-Application Help

- Hover over **ⓘ** icons for tooltips
- Check field placeholder text for examples
- Review error messages for specific guidance

### Administrator Support

Contact your system administrator for:
- Account issues (password reset, role changes)
- Technical problems (errors, performance)
- Feature requests or configuration changes
- Training or clarification

### Best Practices Questions

Consult with:
- **Quality Team**: GxP compliance questions
- **Senior Engineers**: Validation approach
- **IT Department**: Network or access issues

---

## Keyboard Shortcuts

- **Ctrl+K / Cmd+K**: Search (if enabled)
- **Esc**: Close modal dialogs
- **Tab**: Navigate between form fields
- **Enter**: Submit forms (when focused on input)

---

## Appendix: AI Model Information

PharmaSpec Validator uses Google Gemini AI models:

### Document Extraction
- **Model**: gemini-2.5-flash or gemini-2.5-pro
- **Purpose**: Extract text and structure from uploaded documents
- **Performance**: Flash is faster (~30-60s), Pro is more accurate but slower (~2-5min)

### Matrix Generation
- **Model**: gemini-2.5-pro (or Ollama/Llama for on-premise)
- **Purpose**: Analyze requirements against documents, determine compliance
- **Output**: Compliance status (pass/fail/partial), rationale, evidence excerpts

### AI Limitations

Remember that AI is a tool to assist, not replace, engineering judgment:
- **Always review** AI-generated compliance determinations
- **Add context** from your domain expertise
- **Verify evidence** by reading source documents
- **Document rationale** for changing AI assessments
- **Use multiple documents** for comprehensive validation

---

## Regulatory Compliance Notes

PharmaSpec Validator is designed to support GxP validation but:

- The tool generates **draft documentation** for engineer review
- Engineers are responsible for final compliance determinations
- All AI outputs must be reviewed and approved by qualified personnel
- Electronic signatures and audit trails support 21 CFR Part 11 compliance
- Data retention policies align with FDA guidance

**Consult your Quality team for specific regulatory requirements.**

---

## Glossary

- **GxP**: Good Practice quality guidelines (GMP, GLP, GCP, etc.)
- **IQ/OQ/PQ**: Installation/Operational/Performance Qualification
- **Traceability Matrix**: Document linking requirements to test evidence
- **Compliance Status**: Whether a requirement is met (pass/fail/partial)
- **Rationale**: Explanation for compliance determination
- **Evidence**: Supporting text from source documents
- **Audit Trail**: Log of all system changes
- **Electronic Signature**: Digital signature with regulatory compliance

---

## Version History

- **v1.0** (2025-01-17): Initial release with core validation features
  - Project management
  - Requirement tracking
  - Document upload and AI extraction
  - Traceability matrix generation
  - Multiple matrix entries per requirement
  - GxP audit trail
  - CSV export

---

## Feedback and Improvements

Your feedback helps improve PharmaSpec Validator. Please report:
- Bugs or errors
- Confusing workflows
- Feature requests
- Performance issues

Contact your administrator or submit feedback through your company's IT support channels.

---

**Happy Validating!**

For the latest updates and documentation, check with your system administrator.
