# TaskFlow

A simple project management tool created for database management system course in my college. 
TaskFlow allows users to create, manage, and track projects with deadlines, priorities, and status updates.

Note: The only reason to use Oracle 11g was that it was taught in my class. So I wanted to use it. Otherwise, much better and new databases are available that are easier to develop and deploy.

## Features

- Create and manage projects with title, description, deadline, and priority
- Track project status (Not Started, In Progress, Completed)
- View project statistics and distribution by status and priority
- Dark/Light theme toggle with local storage persistence
- Responsive design for all device sizes

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/taskflow.git
   cd taskflow
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_CONNECTION_STRING=localhost:1521/xe
   ORACLE_CLIENT_PATH=C:\\path\\to\\your\\instantclient
   PORT=3000
   ```

4. Start the server:
   ```
   npm start
   ```

5. Access the application at `http://localhost:3000`

## Database Setup

The application uses Oracle database. Execute the SQL scripts in the `db` folder to set up the required tables:

```
db/creatingTables.sql
```

## Technologies

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: Oracle 11g XE DB
