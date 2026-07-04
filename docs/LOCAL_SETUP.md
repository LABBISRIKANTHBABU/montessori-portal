# Local Development Setup Guide

This guide describes how to configure the local development environment, specifically focusing on the database layer once we are ready to integrate it.

## Database Integration (MySQL)

We will use **MySQL Community Server 8.0** for local development to ensure parity with the production Hostinger database.

### Prerequisites
- Windows OS
- Admin access to install software

### Installation Steps (To be executed later)
1. **Download MySQL Installer:**
   Navigate to the [MySQL Downloads page](https://dev.mysql.com/downloads/installer/) and download the MSI installer.
2. **Run Installer:**
   - Select the **Custom** setup type.
   - Select **MySQL Server 8.0.x** and **MySQL Workbench**.
   - Do **NOT** install XAMPP unless you require Apache/PHP for other projects.
3. **Configuration:**
   - Use default port `3306`.
   - Set a strong root password (e.g., `root123` or specific to your preference).
   - Configure MySQL to run as a Windows Service to start automatically.
4. **Initialize Database:**
   - Open MySQL Workbench.
   - Connect using the root credentials.
   - Create the target database: `CREATE DATABASE montessori_portal;`

### Environment Variables
Once MySQL is running, update your backend `.env` file to point to the local database:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_root_password
DB_NAME=montessori_portal
```

### Migrations
After updating the `.env`, run the migration scripts to initialize the locked V1 schema:

```bash
cd backend
npm run migrate:up
```

All application repositories use the configured MySQL database. There is no mock or demo data layer.
