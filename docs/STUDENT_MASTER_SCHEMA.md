# Student Master Schema (Version 1.0)

This document is the **Single Source of Truth** for the Student Data Model. The schema exactly mirrors the `bulk-student.xlsx` template provided by the client. 

Every form, API, validation rule, and database table must map directly to these fields. No additional fields should be invented.

## Excel to Database Mapping

| Excel Column | Database Column | Data Type | Required | Wizard Step | Notes / Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ID No | `legacy_id_no` | VARCHAR | No | Step 1 | Useful for legacy mapping |
| Admission No | `admission_no` | VARCHAR | Yes | Step 1 | Must be unique per campus |
| Name of the Pupil | `student_name` | VARCHAR | Yes | Step 1 | |
| Student Aadhaar No | `student_aadhaar` | VARCHAR | No | Step 1 | 12 digits, masked in UI |
| PEN No | `pen_no` | VARCHAR | No | Step 1 | |
| AAPAR ID | `aapar_id` | VARCHAR | No | Step 1 | |
| Date of Birth | `date_of_birth` | DATE | Yes | Step 1 | |
| Date of Admission | `admission_date` | DATE | Yes | Step 1 | |
| Nationality | `nationality` | VARCHAR | Yes | Step 1 | Default: Indian |
| Religion | `religion` | VARCHAR | No | Step 1 | |
| Caste | `caste` | VARCHAR | No | Step 1 | |
| Sub Caste | `sub_caste` | VARCHAR | No | Step 1 | |
| Mother Tongue | `mother_tongue` | VARCHAR | No | Step 1 | |
| Previous School & Class | `previous_school` | VARCHAR | No | Step 2 | |
| Class Admitted | `class_admitted` | VARCHAR | Yes | Step 2 | |
| Class Leaving | `class_leaving` | VARCHAR | No | Step 2 | Usually empty on import |
| Date of Leaving | `date_of_leaving` | DATE | No | Step 2 | |
| TC Number | `tc_number` | VARCHAR | No | Step 2 | Previous TC |
| Leaving TC No. | `leaving_tc_no` | VARCHAR | No | Step 2 | Issued TC |
| TC Taken Date | `tc_taken_date` | DATE | No | Step 2 | |
| Father Name | `father_name` | VARCHAR | No | Step 3 | |
| Father Qualification| `father_qual` | VARCHAR | No | Step 3 | |
| Father Occupation | `father_occ` | VARCHAR | No | Step 3 | |
| Father Aadhaar No | `father_aadhaar` | VARCHAR | No | Step 3 | |
| Father Mobile Number| `father_mobile` | VARCHAR | No | Step 3 | |
| Father Mail ID | `father_email` | VARCHAR | No | Step 3 | |
| Mother Name | `mother_name` | VARCHAR | No | Step 4 | |
| Mother Qualification| `mother_qual` | VARCHAR | No | Step 4 | |
| Mother Occupation | `mother_occ` | VARCHAR | No | Step 4 | |
| Mother Aadhar No. | `mother_aadhaar` | VARCHAR | No | Step 4 | |
| Mother Mobile No | `mother_mobile` | VARCHAR | No | Step 4 | |
| Mother Mail ID | `mother_email` | VARCHAR | No | Step 4 | |
| Mother Bank Account No| `mother_bank_acc`| VARCHAR | No | Step 4 | |
| Bank IFSC Code | `bank_ifsc` | VARCHAR | No | Step 4 | |
| Residence Address | `residence_address`| TEXT | Yes | Step 5 | |
| Photo of Student | `photo_url` | VARCHAR | No | Step 5 | Path to uploaded image |

## Certificate Usage
The following fields are strictly pulled from this master schema for the **Certificate Engine**:
- Transfer Certificate: `student_name`, `admission_no`, `date_of_birth`, `father_name`, `class_admitted`, `admission_date`, `date_of_leaving`, `leaving_tc_no`.
- Study & Bonafide: `student_name`, `father_name`, `admission_no`, `class_admitted`.

## Report Usage
This standardized data allows for dynamic grouping and aggregation:
- Class-wise list (`class_admitted`)
- Religion / Caste demographics (`religion`, `caste`)
- TC Issued (`leaving_tc_no` IS NOT NULL)

*(Note: Ensure all UI references match this naming convention exactly to streamline the bulk upload mapping.)*
