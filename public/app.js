// Get DOM elements
const form = document.getElementById('add-project');
const projectsContainer = document.getElementById('projects');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Theme toggle functionality
function setupThemeToggle() {
  // Check for saved theme preference or use device preference
  const savedTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  // Apply the theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.setAttribute('data-theme', savedTheme);
  
  // Handle theme toggle button click
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Update theme and save preference
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    console.log('Theme switched to:', newTheme);
    
    // Show feedback
    const alertDiv = document.createElement('div');
    alertDiv.classList.add('custom-alert');
    alertDiv.textContent = `Switched to ${newTheme} mode`;
    document.body.appendChild(alertDiv);
    
    // Remove the alert after 2 seconds
    setTimeout(() => {
      alertDiv.remove();
    }, 2000);
  });
}

// Form submission handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get and validate form data
  const title = form.title.value.trim();
  const deadline = form.deadline.value;
  const description = form.description.value.trim();
  const status = form.status.value;
  const priority = form.elements['priority'].value;

  // Validate required fields
  if (!title || !deadline || !status || !priority) {
    alert('Please fill in all required fields');
    return;
  }

  try {
    const res = await fetch('/add-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, deadline, description, status, priority })
    });

    const result = await res.json();
    if (res.ok) {
      addProjectToDOM(title, deadline, description, status, priority);
      form.reset();
    } else {
      alert(result.error || 'Error saving project to database.');
    }
  } catch (err) {
    console.error('❌ Error:', err);
    alert('Error connecting to server.');
  }
});

function addProjectToDOM(title, deadline, description, status, priority) {
  const proj = document.createElement('div');
  proj.className = 'card project';

  // Sanitize inputs to prevent XSS
  const sanitizeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  // Format description properly
  const formattedDesc = description && description.trim() 
    ? `<div class="description-content">${sanitizeHTML(description)}</div>`
    : '<em>No description provided.</em>';

  proj.innerHTML = `
    <div class="project-header">
        <div>
        <h3>${sanitizeHTML(title)}</h3>
        <div class="meta">
            <select class="status-box">
            <option value="Not Started" ${status==='Not Started'?'selected':''}>Not Started</option>
            <option value="In Progress" ${status==='In Progress'?'selected':''}>In Progress</option>
            <option value="Completed" ${status==='Completed'?'selected':''}>Completed</option>
            </select>
            <span class="priority-tag ${priority.toLowerCase()}">${sanitizeHTML(priority)}</span>
            <span class="deadline">${new Date(deadline).toLocaleDateString()}</span>
        </div>
        </div>
        <div class="chevron"><i class="fa-solid fa-chevron-right"></i></div>
    </div>
    <div class="project-details">
        <h4><i class="fa-solid fa-align-left"></i> Description:</h4>
        <div class="description-box">
        ${formattedDesc}
        </div>
        <button class="edit-btn">Edit</button>
        <div class="delete-btn-wrapper">
          <button class="delete-btn">Delete</button>
        </div>
    </div>
  `;

  // Status select event handlers
  const statusSelect = proj.querySelector('.status-box');
  function updateStatusClass() {
    statusSelect.classList.remove('not-started','in-progress','completed');
    const cls = statusSelect.value.toLowerCase().replace(/\s+/g, '-');
    statusSelect.classList.add(cls);
  }
  statusSelect.addEventListener('change', updateStatusClass);
  statusSelect.addEventListener('click', e => e.stopPropagation());
  statusSelect.addEventListener('focus', e => e.stopPropagation());
  
  // Add event listener to update status in database when changed
  statusSelect.addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    const projectTitle = proj.querySelector('h3').textContent;
    
    try {
      const res = await fetch('/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: projectTitle,
          status: newStatus 
        })
      });
      
      const result = await res.json();
      if (!res.ok) {
        // Create a custom alert that appears on top
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 5px;
          z-index: 1000;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        alertDiv.textContent = result.error || 'Failed to update status';
        document.body.appendChild(alertDiv);
        
        // Remove the alert after 3 seconds
        setTimeout(() => {
          alertDiv.remove();
        }, 3000);
      } else {
        // Reload statistics after status change
        loadProjectStatistics();
      }
    } catch (err) {
      console.error('❌ Error updating status:', err);
      // Create a custom alert that appears on top
      const alertDiv = document.createElement('div');
      alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #f8d7da;
        color: #721c24;
        padding: 15px;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      `;
      alertDiv.textContent = 'Error connecting to server';
      document.body.appendChild(alertDiv);
      
      // Remove the alert after 3 seconds
      setTimeout(() => {
        alertDiv.remove();
      }, 3000);
    }
  });

  updateStatusClass();

  // Project header click handler for expansion
  const header = proj.querySelector('.project-header');
  header.addEventListener('click', (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
    proj.classList.toggle('expanded');
  });

  // Delete button handler
  proj.querySelector('.delete-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const res = await fetch('/delete-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
  
      const result = await res.json();
      if (res.ok) {
        projectsContainer.removeChild(proj);
        // Reload statistics after deleting a project
        loadProjectStatistics();
      } else {
        alert(result.error || 'Failed to delete project from database.');
      }
    } catch (err) {
      console.error('❌ Error deleting project:', err);
      alert('Error connecting to server.');
    }
  });

  // Edit button handler
  const editBtn = proj.querySelector('.edit-btn');
  editBtn.addEventListener('click', async () => {
    const titleEl = proj.querySelector('h3');
    const descBox = proj.querySelector('.description-box');
    const originalTitle = titleEl.textContent;

    if (editBtn.textContent === 'Edit') {
      const titleText = titleEl.textContent;
      const descText = descBox.textContent.trim();
      titleEl.innerHTML = `<input type="text" class="edit-title" value="${sanitizeHTML(titleText)}" />`;
      descBox.innerHTML = `<textarea class="edit-description">${sanitizeHTML(descText)}</textarea>`;
      editBtn.textContent = 'Save';
      
      // Store the original title as a data attribute for reference when saving
      editBtn.setAttribute('data-original-title', originalTitle);
    } else {
      const savedOriginalTitle = editBtn.getAttribute('data-original-title');
      const newTitle = proj.querySelector('.edit-title').value.trim();
      const newDesc = proj.querySelector('.edit-description').value.trim();
      
      console.log('Sending update with original title:', savedOriginalTitle);

      try {
        const res = await fetch('/update-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: savedOriginalTitle,
            newTitle: newTitle || 'Untitled Project',
            description: newDesc
          })
        });

        const result = await res.json();
        if (res.ok) {
          titleEl.textContent = newTitle || 'Untitled Project';
          descBox.innerHTML = newDesc ? sanitizeHTML(newDesc) : '<em>No description provided.</em>';
          editBtn.textContent = 'Edit';
          // Reload statistics after updating a project
          loadProjectStatistics();
        } else {
          // Create a custom alert that appears on top
          const alertDiv = document.createElement('div');
          alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          `;
          alertDiv.textContent = result.error || 'Failed to update project';
          document.body.appendChild(alertDiv);
          
          // Remove the alert after 3 seconds
          setTimeout(() => {
            alertDiv.remove();
          }, 3000);
        }
      } catch (err) {
        console.error('❌ Error updating project:', err);
        // Create a custom alert that appears on top
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 5px;
          z-index: 1000;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        alertDiv.textContent = 'Error connecting to server';
        document.body.appendChild(alertDiv);
        
        // Remove the alert after 3 seconds
        setTimeout(() => {
          alertDiv.remove();
        }, 3000);
      }
    }
  });

  projectsContainer.appendChild(proj);
  
  // Reload statistics after adding a project
  loadProjectStatistics();
}

// Fetch and render saved projects from backend
async function loadProjects() {
  try {
    const res = await fetch('/projects');
    const projects = await res.json();

    if (res.ok) {
      // Clear existing projects
      projectsContainer.innerHTML = '';
      
      // Debug: log the received projects
      console.log('Received projects:', projects);
      
      projects.forEach(project => {
        // Ensure description is a string and not empty
        let description = '';
        if (project.description) {
          if (typeof project.description === 'string') {
            description = project.description.trim();
          } else if (typeof project.description === 'object' && project.description !== null) {
            // Handle if description is an object (e.g., from JSON)
            description = JSON.stringify(project.description);
          }
        }
        
        console.log(`Project "${project.title}" description:`, description);
          
        addProjectToDOM(
          project.title,
          project.deadline,
          description,
          project.status,
          project.priority
        );
      });
    } else {
      console.error('Failed to load projects:', projects.error);
    }
  } catch (err) {
    console.error('❌ Error loading projects:', err);
  }
  
  // After loading projects, also load statistics
  loadProjectStatistics();
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  loadProjects();
  // Load statistics immediately, don't wait for projects to load
  loadProjectStatistics();
});

// Function to load project statistics
async function loadProjectStatistics() {
  try {
    const response = await fetch('/project-stats');
    
    if (!response.ok) {
      console.error('Failed to fetch project statistics');
      return;
    }
    
    const stats = await response.json();
    
    // Update total projects count
    document.getElementById('total-projects').textContent = stats.totalProjects;
    
    // Update status breakdown
    const statusStatsContainer = document.getElementById('status-stats');
    statusStatsContainer.innerHTML = '';
    
    if (stats.byStatus.length === 0) {
      statusStatsContainer.innerHTML = '<p class="no-data">No status data available</p>';
    } else {
      // Calculate total for percentages
      const statusTotal = stats.byStatus.reduce((acc, curr) => acc + curr.COUNT, 0);
      
      // Add status bars
      stats.byStatus.forEach(statusItem => {
        const percentage = Math.round((statusItem.COUNT / statusTotal) * 100);
        const statusClass = statusItem.STATUS.toLowerCase().replace(/\s+/g, '-');
        
        const statusBar = document.createElement('div');
        statusBar.className = 'stat-bar';
        statusBar.innerHTML = `
          <div class="stat-bar-label">
            <span>${statusItem.STATUS}</span>
            <span>${statusItem.COUNT} (${percentage}%)</span>
          </div>
          <div class="stat-bar-progress">
            <div class="stat-bar-fill ${statusClass}" style="width: ${percentage}%"></div>
          </div>
        `;
        
        statusStatsContainer.appendChild(statusBar);
      });
    }
    
    // Update priority distribution
    const priorityStatsContainer = document.getElementById('priority-stats');
    priorityStatsContainer.innerHTML = '';
    
    if (stats.byPriority.length === 0) {
      priorityStatsContainer.innerHTML = '<p class="no-data">No priority data available</p>';
    } else {
      // Calculate total for percentages
      const priorityTotal = stats.byPriority.reduce((acc, curr) => acc + curr.COUNT, 0);
      
      // Add priority bars
      stats.byPriority.forEach(priorityItem => {
        const percentage = Math.round((priorityItem.COUNT / priorityTotal) * 100);
        const priorityClass = priorityItem.PRIORITY.toLowerCase();
        
        const priorityBar = document.createElement('div');
        priorityBar.className = 'stat-bar';
        priorityBar.innerHTML = `
          <div class="stat-bar-label">
            <span>${priorityItem.PRIORITY}</span>
            <span>${priorityItem.COUNT} (${percentage}%)</span>
          </div>
          <div class="stat-bar-progress">
            <div class="stat-bar-fill ${priorityClass}" style="width: ${percentage}%"></div>
          </div>
        `;
        
        priorityStatsContainer.appendChild(priorityBar);
      });
    }
  } catch (err) {
    console.error('Error loading statistics:', err);
  }
}
