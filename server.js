require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const path = require('path');

// Initialize Oracle client
try {
  oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH });
} catch (err) {
  console.error('Failed to initialize Oracle client:', err);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION_STRING
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Root route handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Input validation middleware
const validateProject = (req, res, next) => {
  const { title, description, deadline, status, priority } = req.body;
  
  if (!title || !deadline || !status || !priority) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields' 
    });
  }

  const validStatuses = ['Not Started', 'In Progress', 'Completed'];
  const validPriorities = ['High', 'Medium', 'Low'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid status value' 
    });
  }

  if (!validPriorities.includes(priority)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid priority value' 
    });
  }

  next();
};

// Add Project
app.post('/add-project', validateProject, async (req, res) => {
  const { title, description, deadline, status, priority } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    // Create a CLOB for the description
    const clob = await connection.createLob(oracledb.CLOB);
    await clob.write(description || '');

    const result = await connection.execute(
      `INSERT INTO projects (title, description, deadline, status, priority)
       VALUES (:title, :description, TO_DATE(:deadline, 'YYYY-MM-DD'), :status, :priority)`,
      { 
        title, 
        description: clob, 
        deadline, 
        status, 
        priority 
      },
      { autoCommit: true }
    );

    res.json({ success: true, message: 'Project added successfully!' });
  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add project to database' 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// Update Project
app.post('/update-project', async (req, res) => {
  const { title, newTitle, description } = req.body;
  let connection;
  let lobOutBinds = {};

  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Check if project exists
    const checkResult = await connection.execute(
      `SELECT COUNT(*) AS COUNT FROM projects WHERE UPPER(title) = UPPER(:title)`,
      { title: title },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkResult.rows[0].COUNT === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }

    // Oracle approach for updating CLOB
    const result = await connection.execute(
      `UPDATE projects 
       SET title = :newTitle,
           description = EMPTY_CLOB()
       WHERE UPPER(title) = UPPER(:title)
       RETURNING description INTO :lobOut`,
      { 
        title: title,
        newTitle: newTitle,
        lobOut: { type: oracledb.CLOB, dir: oracledb.BIND_OUT }
      },
      { autoCommit: false }
    );
    
    // Get the LOB locator from the OUT bind
    const lob = result.outBinds.lobOut[0];
    
    // Write data to the LOB
    if (lob) {
      await lob.write(description || '');
      await lob.close();
    }
    
    // Commit the transaction
    await connection.commit();

    res.json({ success: true, message: 'Project updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Error rolling back transaction:', rollbackErr);
      }
    }
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update project: ' + err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// Get Projects
app.get('/projects', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Configure the query to handle LOBs as strings
    const options = { 
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: { 
        "DESCRIPTION": { type: oracledb.STRING } 
      }
    };
    
    const result = await connection.execute(
      `SELECT TITLE, DEADLINE, DESCRIPTION, STATUS, PRIORITY FROM PROJECTS`,
      [], 
      options
    );

    // Process the results
    const projects = result.rows.map(row => {
      // Ensure description is a string
      let description = '';
      if (row.DESCRIPTION) {
        description = row.DESCRIPTION.toString();
      }
      
      return {
        title: row.TITLE,
        deadline: row.DEADLINE,
        description: description,
        status: row.STATUS,
        priority: row.PRIORITY
      };
    });

    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch projects: ' + err.message 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// Delete Project
app.post('/delete-project', async (req, res) => {
  const { title } = req.body;
  let connection;

  if (!title) {
    return res.status(400).json({ 
      success: false, 
      error: 'Project title is required' 
    });
  }

  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `DELETE FROM projects WHERE title = :title`,
      [title],
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete project' 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// Update Status
app.post('/update-status', async (req, res) => {
  const { title, status } = req.body;
  let connection;

  if (!title || !status) {
    return res.status(400).json({ 
      success: false, 
      error: 'Title and status are required' 
    });
  }

  // Validate status
  const validStatuses = ['Not Started', 'In Progress', 'Completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid status value' 
    });
  }

  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Check if the project exists
    const checkResult = await connection.execute(
      `SELECT COUNT(*) AS COUNT FROM projects WHERE UPPER(title) = UPPER(:title)`,
      { title: title },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkResult.rows[0].COUNT === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }

    // Update the project status
    await connection.execute(
      `UPDATE projects SET status = :status WHERE UPPER(title) = UPPER(:title)`,
      { 
        title: title,
        status: status 
      },
      { autoCommit: true }
    );

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update status: ' + err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
