// ===== STATE MANAGEMENT =====
const app = {
    currentUser: null,
    users: {},
    portfolios: {}
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    setupEventListeners();

    const loggedInEmail = localStorage.getItem('loggedInUser');
    const hasValidSession = loggedInEmail && app.users[loggedInEmail];

    if (document.body.dataset.page !== 'dashboard') {
        if (hasValidSession) window.location.replace('dashboard.html');
        return;
    }

    if (!hasValidSession) {
        window.location.replace('index.html');
        return;
    }

    app.currentUser = app.users[loggedInEmail];
    showAppSection();
    loadPortfolioData();
    loadEditorContent();
    switchTab('profile');
});

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchTab(e.target.closest('.nav-tab').dataset.tab);
        });
    });
}

function loadDataFromStorage() {
    const usersData = localStorage.getItem('users');
    const portfoliosData = localStorage.getItem('portfolios');

    if (usersData) app.users = JSON.parse(usersData);
    if (portfoliosData) app.portfolios = JSON.parse(portfoliosData);
}

function saveDataToStorage() {
    localStorage.setItem('users', JSON.stringify(app.users));
    localStorage.setItem('portfolios', JSON.stringify(app.portfolios));
}

// ===== AUTHENTICATION =====
function toggleAuthForm(e) {
    e.preventDefault();
    document.getElementById('loginForm').classList.toggle('active');
    document.getElementById('signupForm').classList.toggle('active');
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!app.users[email]) {
        showToast('Invalid email or password', 'error');
        return;
    }

    if (!await verifyPassword(password, app.users[email])) {
        showToast('Invalid email or password', 'error');
        return;
    }

    if (!app.users[email].passwordHash) {
        const credential = await hashPassword(password);
        app.users[email].passwordHash = credential.passwordHash;
        app.users[email].passwordSalt = credential.passwordSalt;
        delete app.users[email].password;
        saveDataToStorage();
    }

    app.currentUser = app.users[email];
    localStorage.setItem('loggedInUser', email);
    showToast('Login successful!', 'success');

    setTimeout(() => {
        window.location.assign('dashboard.html');
    }, 500);
}

async function handleSignup(event) {
    event.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const password2 = document.getElementById('signupPassword2').value;

    if (password !== password2) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (app.users[email]) {
        showToast('Email already registered', 'error');
        return;
    }

    app.users[email] = {
        name,
        email,
        ...(await hashPassword(password)),
        createdAt: new Date().toISOString()
    };

    saveDataToStorage();
    showToast('Account created! Please login', 'success');

    setTimeout(() => {
        toggleAuthForm(new Event('click'));
        document.getElementById('loginEmail').value = email;
    }, 500);
}

async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const bytes = new TextEncoder().encode(password);
    const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
    const digest = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt,
        iterations: 120000,
        hash: 'SHA-256'
    }, key, 256);
    return {
        passwordSalt: Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join(''),
        passwordHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    };
}

async function verifyPassword(password, user) {
    if (user.passwordHash && user.passwordSalt) {
        const salt = Uint8Array.from(user.passwordSalt.match(/.{2}/g), byte => parseInt(byte, 16));
        const bytes = new TextEncoder().encode(password);
        const key = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits']);
        const digest = await crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt,
            iterations: 120000,
            hash: 'SHA-256'
        }, key, 256);
        const actualHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        return actualHash === user.passwordHash;
    }
    if (user.passwordHash) return false;
    return user.password === password;
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('loggedInUser');
        app.currentUser = null;
        window.location.replace('index.html');
    }
}

// ===== UI NAVIGATION =====
function showAuthSection() {
    document.getElementById('authSection')?.classList.add('active');
    document.getElementById('appSection')?.classList.remove('active');
}

function showAppSection() {
    document.getElementById('authSection')?.classList.remove('active');
    document.getElementById('appSection')?.classList.add('active');
    updateUserDisplay();
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    const contentTab = ['profile', 'about', 'skills', 'projects', 'experience', 'education', 'templates'].includes(tabName)
        ? 'editor'
        : tabName;
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(contentTab)?.classList.add('active');

    const sectionMap = {
        profile: 'profileSection',
        about: 'aboutSection',
        skills: 'skillsSection',
        projects: 'projectsSection',
        experience: 'experienceSection',
        education: 'educationSection',
        templates: 'templatesSection'
    };
    document.querySelectorAll('.editor-forms > .form-section').forEach(section => {
        section.classList.toggle('section-current', section.id === sectionMap[tabName]);
    });
    const sectionTitle = document.getElementById('editorSectionTitle');
    if (sectionTitle && sectionMap[tabName]) {
        sectionTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    }

    if (contentTab === 'editor') {
        loadEditorContent();
    } else if (contentTab === 'preview') {
        loadFullPreview();
    } else if (contentTab === 'settings') {
        loadSettings();
    }
}

function updateUserDisplay() {
    if (!app.currentUser) return;

    document.getElementById('userName').textContent = app.currentUser.name.split(' ')[0];
    document.getElementById('dashboardName').textContent = app.currentUser.name.split(' ')[0];
}

// ===== PORTFOLIO DATA MANAGEMENT =====
function loadPortfolioData() {
    const email = app.currentUser.email;

    if (!app.portfolios[email]) {
        app.portfolios[email] = getDefaultPortfolio();
        saveDataToStorage();
    }

    populateFormFields();
}

function getDefaultPortfolio() {
    return {
        name: app.currentUser.name,
        email: app.currentUser.email,
        phone: '',
        location: '',
        title: '',
        bio: '',
        profilePicture: '',
        skills: [],
        experience: [],
        projects: [],
        education: [],
        social: [],
        template: 'modern',
        theme: { primary: '#6253c7', secondary: '#3975d5' }
    };
}

function getPortfolioData() {
    return app.portfolios[app.currentUser.email];
}

function populateFormFields() {
    const portfolio = getPortfolioData();
    
    document.getElementById('formName').value = portfolio.name;
    document.getElementById('formEmail').value = portfolio.email;
    document.getElementById('formPhone').value = portfolio.phone || '';
    document.getElementById('formLocation').value = portfolio.location || '';
}

function savePortfolioData() {
    const portfolio = getPortfolioData();

    portfolio.name = document.getElementById('formName').value || app.currentUser.name;
    portfolio.email = document.getElementById('formEmail').value;
    portfolio.phone = document.getElementById('formPhone').value;
    portfolio.location = document.getElementById('formLocation').value;
    portfolio.title = document.getElementById('formTitle').value;
    portfolio.bio = document.getElementById('formBio').value;
    portfolio.template = document.getElementById('templateSelect').value;
    portfolio.theme = {
        primary: document.getElementById('themePrimary').value,
        secondary: document.getElementById('themeSecondary').value
    };

    saveDataToStorage();
}

function changeTemplate() {
    savePortfolioData();
    updatePreview();
}

function changeTheme() {
    const portfolio = getPortfolioData();
    portfolio.theme = {
        primary: document.getElementById('themePrimary').value,
        secondary: document.getElementById('themeSecondary').value
    };
    document.documentElement.style.setProperty('--primary', portfolio.theme.primary);
    document.documentElement.style.setProperty('--secondary', portfolio.theme.secondary);
    saveDataToStorage();
    updatePreview();
}

function exportPortfolioData() {
    const blob = new Blob([JSON.stringify(getPortfolioData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'portfolio-backup.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importPortfolioData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);
            const requiredArrays = ['skills', 'experience', 'projects', 'social'];
            if (!imported || typeof imported !== 'object' || requiredArrays.some(key => imported[key] && !Array.isArray(imported[key]))) {
                throw new Error('Invalid portfolio data');
            }
            app.portfolios[app.currentUser.email] = {
                ...getDefaultPortfolio(),
                ...imported,
                email: app.currentUser.email,
                education: Array.isArray(imported.education) ? imported.education : [],
                theme: imported.theme || { primary: '#6253c7', secondary: '#3975d5' }
            };
            saveDataToStorage();
            loadEditorContent();
            showToast('Portfolio backup loaded', 'success');
        } catch (error) {
            showToast('That backup file could not be loaded', 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ===== EDITOR CONTENT =====
function loadEditorContent() {
    const portfolio = getPortfolioData();

    // Load profile picture
    if (portfolio.profilePicture) {
        document.getElementById('profilePicturePreview').src = portfolio.profilePicture;
        document.getElementById('profilePicturePreview').style.display = 'block';
        document.getElementById('profilePicturePlaceholder').style.display = 'none';
    } else {
        document.getElementById('profilePicturePreview').style.display = 'none';
        document.getElementById('profilePicturePlaceholder').style.display = 'flex';
    }
    
    document.getElementById('formTitle').value = portfolio.title;
    document.getElementById('formBio').value = portfolio.bio;
    document.getElementById('templateSelect').value = portfolio.template;

    loadSkillsList();
    loadExperienceList();
    loadProjectsList();
    loadEducationList();
    loadSocialList();

    const theme = portfolio.theme || { primary: '#6253c7', secondary: '#3975d5' };
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--secondary', theme.secondary);
    document.getElementById('themePrimary').value = theme.primary;
    document.getElementById('themeSecondary').value = theme.secondary;

    updatePreview();
}

// ===== SKILLS MANAGEMENT =====
function loadSkillsList() {
    const portfolio = getPortfolioData();
    const skillsList = document.getElementById('skillsList');
    skillsList.innerHTML = '';

    portfolio.skills.forEach((skill, index) => {
        const skillItem = document.createElement('div');
        skillItem.className = 'list-item';
        skillItem.innerHTML = `
            <input type="text" value="${skill}" placeholder="Skill name" onchange="updateSkill(${index}, this.value)">
            <button onclick="removeSkill(${index})">Delete</button>
        `;
        skillsList.appendChild(skillItem);
    });
}

function addSkill() {
    const portfolio = getPortfolioData();
    portfolio.skills.push('New Skill');
    savePortfolioData();
    loadSkillsList();
    updatePreview();
    openEditorSection('skillsSection', '#skillsList input:last-of-type');
}

function openEditorSection(sectionId, focusSelector) {
    const tabBySection = {
        profileSection: 'profile',
        aboutSection: 'about',
        skillsSection: 'skills',
        projectsSection: 'projects',
        experienceSection: 'experience',
        educationSection: 'education',
        templatesSection: 'templates'
    };
    switchTab(tabBySection[sectionId] || 'profile');
    requestAnimationFrame(() => {
        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section?.querySelector(focusSelector)?.focus();
    });
}

function updateSkill(index, value) {
    const portfolio = getPortfolioData();
    portfolio.skills[index] = value;
    savePortfolioData();
    updatePreview();
}

function removeSkill(index) {
    const portfolio = getPortfolioData();
    portfolio.skills.splice(index, 1);
    savePortfolioData();
    loadSkillsList();
    updatePreview();
}

// ===== EXPERIENCE MANAGEMENT =====
function loadExperienceList() {
    const portfolio = getPortfolioData();
    const expList = document.getElementById('experienceList');
    expList.innerHTML = '';

    portfolio.experience.forEach((exp, index) => {
        const expItem = document.createElement('div');
        expItem.className = 'list-item';
        expItem.innerHTML = `
            <div style="flex: 1;">
                <input type="text" placeholder="Job Title" value="${exp.title}" onchange="updateExperience(${index}, 'title', this.value)" style="margin-bottom: 8px;">
                <input type="text" placeholder="Company" value="${exp.company}" onchange="updateExperience(${index}, 'company', this.value)" style="margin-bottom: 8px;">
                <input type="text" placeholder="Duration" value="${exp.duration}" onchange="updateExperience(${index}, 'duration', this.value)">
                <textarea placeholder="Role highlights" onchange="updateExperience(${index}, 'description', this.value)" style="margin-top: 8px;">${exp.description || ''}</textarea>
            </div>
            <button onclick="removeExperience(${index})" style="margin-left: 10px;">Delete</button>
        `;
        expList.appendChild(expItem);
    });
}

function addExperience() {
    const portfolio = getPortfolioData();
    portfolio.experience.push({ title: 'New Position', company: 'Company Name', duration: 'Start Date - End Date', description: 'Job description here' });
    savePortfolioData();
    loadExperienceList();
    updatePreview();
    openEditorSection('experienceSection', '#experienceList input');
}

function updateExperience(index, field, value) {
    const portfolio = getPortfolioData();
    portfolio.experience[index][field] = value;
    savePortfolioData();
    updatePreview();
}

function removeExperience(index) {
    const portfolio = getPortfolioData();
    portfolio.experience.splice(index, 1);
    savePortfolioData();
    loadExperienceList();
    updatePreview();
}

// ===== EDUCATION MANAGEMENT =====
function loadEducationList() {
    const portfolio = getPortfolioData();
    const educationList = document.getElementById('educationList');
    educationList.innerHTML = '';

    portfolio.education = portfolio.education || [];
    portfolio.education.forEach((education, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div style="flex: 1;">
                <input type="text" placeholder="Degree or qualification" value="${education.degree || ''}" onchange="updateEducation(${index}, 'degree', this.value)" style="margin-bottom: 8px;">
                <input type="text" placeholder="School or institution" value="${education.school || ''}" onchange="updateEducation(${index}, 'school', this.value)" style="margin-bottom: 8px;">
                <input type="text" placeholder="Years attended" value="${education.duration || ''}" onchange="updateEducation(${index}, 'duration', this.value)" style="margin-bottom: 8px;">
                <textarea placeholder="Additional details" onchange="updateEducation(${index}, 'description', this.value)">${education.description || ''}</textarea>
            </div>
            <button onclick="removeEducation(${index})">Delete</button>
        `;
        educationList.appendChild(item);
    });
}

function addEducation() {
    const portfolio = getPortfolioData();
    portfolio.education = portfolio.education || [];
    portfolio.education.push({ degree: 'Degree or qualification', school: 'Institution name', duration: '', description: '' });
    savePortfolioData();
    loadEducationList();
    updatePreview();
    openEditorSection('educationSection', '#educationList input');
}

function updateEducation(index, field, value) {
    getPortfolioData().education[index][field] = value;
    savePortfolioData();
    updatePreview();
}

function removeEducation(index) {
    getPortfolioData().education.splice(index, 1);
    savePortfolioData();
    loadEducationList();
    updatePreview();
}

// ===== PROJECTS MANAGEMENT =====
function loadProjectsList() {
    const portfolio = getPortfolioData();
    const projectsList = document.getElementById('projectsList');
    projectsList.innerHTML = '';

    portfolio.projects.forEach((project, index) => {
        const projItem = document.createElement('div');
        projItem.className = 'list-item';
        projItem.innerHTML = `
            <div style="flex: 1;">
                <input type="text" placeholder="Project Title" value="${project.title}" onchange="updateProject(${index}, 'title', this.value)" style="margin-bottom: 8px;">
                <input type="text" placeholder="Description" value="${project.description}" onchange="updateProject(${index}, 'description', this.value)" style="margin-bottom: 8px;">
                <button type="button" class="btn btn-small btn-secondary" onclick="generateProjectDescription(${index})" style="margin-bottom: 8px;"><i class="fas fa-sparkles"></i> Generate Description</button>
                <input type="text" placeholder="Technology" value="${project.tech}" onchange="updateProject(${index}, 'tech', this.value)" style="margin-bottom: 8px;">
                <textarea placeholder="Project features (one per line)" onchange="updateProject(${index}, 'features', this.value)" style="margin-bottom: 8px;">${Array.isArray(project.features) ? project.features.join('\n') : (project.features || '')}</textarea>
                <input type="url" placeholder="GitHub URL" value="${project.github || ''}" onchange="updateProject(${index}, 'github', this.value)" style="margin-bottom: 8px;">
                <input type="url" placeholder="Demo URL" value="${project.demo || ''}" onchange="updateProject(${index}, 'demo', this.value)">
            </div>
            <button onclick="removeProject(${index})" style="margin-left: 10px;">Delete</button>
        `;
        projectsList.appendChild(projItem);
    });
}

function addProject() {
    const portfolio = getPortfolioData();
    portfolio.projects.push({ title: 'New Project', tech: 'Technologies used', description: 'Project description', features: '', github: '', demo: '' });
    savePortfolioData();
    loadProjectsList();
    updatePreview();
    openEditorSection('projectsSection', '#projectsList input');
}

function updateProject(index, field, value) {
    const portfolio = getPortfolioData();
    portfolio.projects[index][field] = value;
    savePortfolioData();
    updatePreview();
}

function generateProjectDescription(index) {
    const project = getPortfolioData().projects[index];
    const title = project.title && project.title !== 'New Project' ? project.title : 'This project';
    const technologies = (project.tech || '').trim();
    const technologyText = technologies && technologies !== 'Technologies used' ? ` using ${technologies}` : '';
    project.description = `${title} is a thoughtfully built solution${technologyText}, designed to deliver a clear and reliable user experience.`;
    savePortfolioData();
    loadProjectsList();
    updatePreview();
    showToast('Project description generated', 'success');
}

function removeProject(index) {
    const portfolio = getPortfolioData();
    portfolio.projects.splice(index, 1);
    savePortfolioData();
    loadProjectsList();
    updatePreview();
}

// ===== SOCIAL LINKS MANAGEMENT =====
function loadSocialList() {
    const portfolio = getPortfolioData();
    const socialList = document.getElementById('socialList');
    socialList.innerHTML = '';

    portfolio.social.forEach((social, index) => {
        const socialItem = document.createElement('div');
        socialItem.className = 'list-item';
        socialItem.innerHTML = `
            <div style="flex: 1;">
                <input type="text" placeholder="Platform (GitHub, LinkedIn, etc.)" value="${social.platform}" onchange="updateSocial(${index}, 'platform', this.value)" style="margin-bottom: 8px;">
                <input type="url" placeholder="URL" value="${social.url}" onchange="updateSocial(${index}, 'url', this.value)">
            </div>
            <button onclick="removeSocial(${index})" style="margin-left: 10px;">Delete</button>
        `;
        socialList.appendChild(socialItem);
    });
}

function addSocial() {
    const portfolio = getPortfolioData();
    portfolio.social.push({ platform: 'Platform', url: 'https://example.com' });
    savePortfolioData();
    loadSocialList();
    updatePreview();
}

function updateSocial(index, field, value) {
    const portfolio = getPortfolioData();
    portfolio.social[index][field] = value;
    savePortfolioData();
    updatePreview();
}

function removeSocial(index) {
    const portfolio = getPortfolioData();
    portfolio.social.splice(index, 1);
    savePortfolioData();
    loadSocialList();
    updatePreview();
}

// ===== PROFILE PICTURE HANDLING =====
function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const portfolio = getPortfolioData();
            portfolio.profilePicture = e.target.result;
            saveDataToStorage();
            
            // Update preview
            document.getElementById('profilePicturePreview').src = e.target.result;
            document.getElementById('profilePicturePreview').style.display = 'block';
            document.getElementById('profilePicturePlaceholder').style.display = 'none';
            
            updatePreview();
            showToast('Profile picture updated!', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function removeProfilePicture() {
    const portfolio = getPortfolioData();
    portfolio.profilePicture = '';
    saveDataToStorage();
    loadEditorContent();
    updatePreview();
    showToast('Profile picture removed', 'success');
}

// ===== PREVIEW GENERATION =====
function updatePreview() {
    savePortfolioData();
    const previewContent = generatePortfolioHTML(true);
    document.getElementById('livePreview').innerHTML = previewContent;
}

function loadFullPreview() {
    const previewContent = generatePortfolioHTML(false);
    document.getElementById('fullPreview').innerHTML = previewContent;
}

function generatePortfolioHTML(isPreview = false) {
    const portfolio = getPortfolioData();
    const template = portfolio.template;

    let html = `<div class="portfolio-${template}">`;
    
    // Profile picture in header
    const profilePicHtml = portfolio.profilePicture ? 
        `<div class="profile-picture-container">
            <img src="${portfolio.profilePicture}" alt="${portfolio.name}" class="portfolio-profile-pic">
        </div>` : '';
    
    html += `
        <div class="portfolio-header">
            ${profilePicHtml}
            <div class="portfolio-name">${portfolio.name}</div>
            <div class="portfolio-title">${portfolio.title || 'Professional'}</div>
            ${portfolio.location ? `<div class="portfolio-location"><i class="fas fa-map-marker-alt"></i> ${portfolio.location}</div>` : ''}
        </div>`;

    if (portfolio.bio) {
        html += `<div class="portfolio-bio">${portfolio.bio}</div>`;
    }

    // Skills
    if (portfolio.skills.length > 0) {
        html += `
            <div class="portfolio-section">
                <div class="portfolio-section-title">Skills</div>
                <div class="skills-grid">
                    ${portfolio.skills.map(skill => `<div class="skill-tag">${skill}</div>`).join('')}
                </div>
            </div>
        `;
    }

    // Experience
    if (portfolio.experience.length > 0) {
        html += `<div class="portfolio-section"><div class="portfolio-section-title">Experience</div>`;
        portfolio.experience.forEach(exp => {
            if (exp.title || exp.company) {
                html += `
                    <div class="portfolio-item">
                        <div class="portfolio-item-title">${exp.title}</div>
                        <div class="portfolio-item-subtitle">${exp.company}${exp.duration ? ` • ${exp.duration}` : ''}</div>
                        ${exp.description ? `<div class="portfolio-item-description">${exp.description}</div>` : ''}
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    if (portfolio.education && portfolio.education.length > 0) {
        html += `<div class="portfolio-section"><div class="portfolio-section-title">Education</div>`;
        portfolio.education.forEach(education => {
            if (education.degree || education.school) {
                html += `<div class="portfolio-item"><div class="portfolio-item-title">${education.degree || ''}</div><div class="portfolio-item-subtitle">${education.school || ''}${education.duration ? ` • ${education.duration}` : ''}</div>${education.description ? `<div class="portfolio-item-description">${education.description}</div>` : ''}</div>`;
            }
        });
        html += `</div>`;
    }

    // Projects
    if (portfolio.projects.length > 0) {
        html += `<div class="portfolio-section portfolio-projects-section"><div class="portfolio-section-title">Projects</div>`;
        portfolio.projects.forEach((project, index) => {
            if (project.title) {
                const technologies = (project.tech || '').split(',').map(item => item.trim()).filter(Boolean);
                html += `
                    <button type="button" class="portfolio-project-card" onclick="openProjectModal(${index})" aria-label="View details for ${project.title}">
                        <span class="project-card-topline"><span class="project-card-icon"><i class="fas fa-code"></i></span><i class="fas fa-arrow-up-right-from-square project-card-arrow"></i></span>
                        <div class="portfolio-item-title">${project.title}</div>
                        <div class="portfolio-item-description">${project.description || 'Explore the project details.'}</div>
                        <span class="project-tech-list">${technologies.slice(0, 4).map(tech => `<span class="project-tech-tag">${tech}</span>`).join('')}</span>
                    </button>
                `;
            }
        });
        html += `</div>`;
    }

    // Contact & Social
    html += `<div class="portfolio-section"><div class="portfolio-section-title">Get In Touch</div>`;
    html += `<div style="margin-bottom: 15px;">`;
    if (portfolio.email) html += `<div><strong>Email:</strong> ${portfolio.email}</div>`;
    if (portfolio.phone) html += `<div><strong>Phone:</strong> ${portfolio.phone}</div>`;
    html += `</div>`;

    if (portfolio.social.length > 0) {
        html += `<div class="social-links">`;
        portfolio.social.forEach(social => {
            if (social.url) {
                const icon = getSocialIcon(social.platform);
                html += `<a href="${social.url}" target="_blank" class="social-link" title="${social.platform}"><i class="${icon}"></i></a>`;
            }
        });
        html += `</div>`;
    }
    html += `</div>`;

    html += `</div>`;
    return html;
}

function openProjectModal(index) {
    const project = getPortfolioData().projects[index];
    if (!project) return;

    const features = Array.isArray(project.features)
        ? project.features
        : (project.features || '').split('\n').map(feature => feature.trim()).filter(Boolean);
    const technologies = (project.tech || '').split(',').map(item => item.trim()).filter(Boolean);
    document.getElementById('projectModalBody').innerHTML = `
        <span class="project-modal-eyebrow"><i class="fas fa-code"></i> Featured project</span>
        <h2 id="projectModalTitle">${project.title || 'Project details'}</h2>
        <p class="project-modal-description">${project.description || 'No description added yet.'}</p>
        ${features.length ? `<section class="project-modal-section"><h3>Features</h3><ul>${features.map(feature => `<li>${feature}</li>`).join('')}</ul></section>` : ''}
        ${technologies.length ? `<section class="project-modal-section"><h3>Technologies</h3><div class="project-tech-list">${technologies.map(tech => `<span class="project-tech-tag">${tech}</span>`).join('')}</div></section>` : ''}
        <div class="project-modal-actions">
            ${project.github ? `<a class="btn btn-secondary" href="${project.github}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> GitHub</a>` : ''}
            ${project.demo ? `<a class="btn btn-primary" href="${project.demo}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> Live demo</a>` : ''}
        </div>
    `;
    document.getElementById('projectModal').classList.add('active');
    document.querySelector('#projectModal .modal-close').focus();
}

function closeProjectModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('projectModal').classList.remove('active');
}

function getSocialIcon(platform) {
    const icons = {
        'github': 'fab fa-github',
        'linkedin': 'fab fa-linkedin',
        'twitter': 'fab fa-twitter',
        'facebook': 'fab fa-facebook',
        'instagram': 'fab fa-instagram',
        'codepen': 'fab fa-codepen',
        'dribbble': 'fab fa-dribbble',
        'portfolio': 'fas fa-globe',
        'website': 'fas fa-globe',
        'blog': 'fas fa-blog'
    };

    const lower = platform.toLowerCase();
    return icons[lower] || 'fas fa-link';
}

// ===== AI BIO GENERATOR =====
function generateBio() {
    document.getElementById('aiModal').classList.add('active');
}

function closeAiModal() {
    document.getElementById('aiModal').classList.remove('active');
    document.getElementById('aiOutput').classList.remove('visible');
}

function generateAiBio() {
    const years = document.getElementById('aiYears').value || 0;
    const specialty = document.getElementById('aiSpecialty').value || 'Software Development';
    const achievements = document.getElementById('aiAchievements').value;

    const bioPrefixes = [
        `Passionate ${specialty} professional with ${years} years of experience in creating innovative solutions.`,
        `Results-driven ${specialty} specialist with ${years}+ years of proven expertise.`,
        `Creative and dedicated developer specializing in ${specialty} for the past ${years} years.`,
        `Dynamic ${specialty} expert bringing ${years} years of technical excellence and innovation.`
    ];

    const bioSuffixes = [
        `I'm committed to building scalable, maintainable, and user-friendly applications. I thrive in collaborative environments and am passionate about continuous learning.`,
        `Dedicated to delivering high-quality solutions that exceed expectations. Always eager to tackle new challenges and grow professionally.`,
        `My goal is to create meaningful digital experiences that solve real-world problems. I believe in clean code and best practices.`,
        `Focused on writing efficient, elegant code while staying updated with the latest industry trends and technologies.`
    ];

    let bio = bioPrefixes[Math.floor(Math.random() * bioPrefixes.length)];

    if (achievements) {
        bio += ` Key achievements include: ${achievements}.`;
    }

    bio += ` ${bioSuffixes[Math.floor(Math.random() * bioSuffixes.length)]}`;

    const outputDiv = document.getElementById('aiOutput');
    outputDiv.innerHTML = bio;
    outputDiv.classList.add('visible');
}

// ===== SETTINGS =====
function loadSettings() {
    document.getElementById('settingsEmail').textContent = app.currentUser.email;
    document.getElementById('settingsName').textContent = app.currentUser.name;

    const publicUrl = `${window.location.origin}/?view=${app.currentUser.email.replace('@', '_at_').replace('.', '_')}`;
    document.getElementById('publicUrl').textContent = publicUrl;
}

function changePassword() {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        app.currentUser.password = newPassword;
        app.users[app.currentUser.email].password = newPassword;
        saveDataToStorage();
        showToast('Password changed successfully', 'success');
    }
}

function copyPublicUrl() {
    const publicUrl = `${window.location.origin}/?view=${app.currentUser.email.replace('@', '_at_').replace('.', '_')}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
        showToast('Portfolio URL copied to clipboard!', 'success');
    });
}

// ===== DOWNLOAD PORTFOLIO =====
function downloadPortfolio() {
    const portfolio = getPortfolioData();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${portfolio.name} - Portfolio</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
            padding: 40px 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .portfolio-header {
            text-align: center;
            padding: 30px 0 40px;
            border-bottom: 3px solid #667eea;
            margin-bottom: 40px;
        }
        .portfolio-name {
            font-size: 2.5rem;
            color: #333;
            margin-bottom: 10px;
            font-family: 'Playfair Display', serif;
        }
        .portfolio-title {
            font-size: 1.3rem;
            color: #667eea;
            font-weight: 600;
        }
        .portfolio-section {
            margin-bottom: 30px;
        }
        .portfolio-section-title {
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
            display: inline-block;
            font-family: 'Playfair Display', serif;
        }
        .skill-tag {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            display: inline-block;
            margin: 5px 10px 5px 0;
            font-weight: 600;
        }
        .portfolio-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }
        .portfolio-item-title {
            font-weight: 700;
            color: #333;
            margin-bottom: 5px;
        }
        .portfolio-item-subtitle {
            color: #667eea;
            font-weight: 600;
            font-size: 0.9rem;
            margin-bottom: 8px;
        }
        .portfolio-bio {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }
        .skills-grid {
            display: flex;
            flex-wrap: wrap;
        }
        .contact-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
        }
        .social-links {
            display: flex;
            gap: 15px;
            margin-top: 15px;
        }
        .social-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            text-decoration: none;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.9rem;
        }
        @media (max-width: 768px) {
            .container { padding: 20px; }
            .portfolio-name { font-size: 1.8rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="portfolio-header">
            ${portfolio.profilePicture ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${portfolio.profilePicture}" alt="${portfolio.name}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; border: 5px solid #667eea;"></div>` : ''}
            <div class="portfolio-name">${portfolio.name}</div>
            <div class="portfolio-title">${portfolio.title || 'Professional'}</div>
            ${portfolio.location ? `<div style="color: #666; margin-top: 10px;"><i class="fas fa-map-marker-alt"></i> ${portfolio.location}</div>` : ''}
        </div>

        ${portfolio.bio ? `<div class="portfolio-bio">${portfolio.bio}</div>` : ''}

        ${portfolio.skills.length > 0 ? `
        <div class="portfolio-section">
            <div class="portfolio-section-title">Skills</div>
            <div class="skills-grid">
                ${portfolio.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        ${portfolio.experience.length > 0 ? `
        <div class="portfolio-section">
            <div class="portfolio-section-title">Experience</div>
            ${portfolio.experience.map(exp => `
                <div class="portfolio-item">
                    <div class="portfolio-item-title">${exp.title}</div>
                    <div class="portfolio-item-subtitle">${exp.company}${exp.duration ? ` • ${exp.duration}` : ''}</div>
                    ${exp.description ? `<div class="portfolio-item-description">${exp.description}</div>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${portfolio.education && portfolio.education.length > 0 ? `
        <div class="portfolio-section">
            <div class="portfolio-section-title">Education</div>
            ${portfolio.education.map(education => `
                <div class="portfolio-item">
                    <div class="portfolio-item-title">${education.degree || ''}</div>
                    <div class="portfolio-item-subtitle">${education.school || ''}${education.duration ? ` • ${education.duration}` : ''}</div>
                    ${education.description ? `<div class="portfolio-item-description">${education.description}</div>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${portfolio.projects.length > 0 ? `
        <div class="portfolio-section">
            <div class="portfolio-section-title">Projects</div>
            ${portfolio.projects.map(project => `
                <div class="portfolio-item">
                    <div class="portfolio-item-title">${project.title}</div>
                    <div class="portfolio-item-subtitle">${project.tech}</div>
                    <div>${project.description}</div>
                    ${project.github ? `<div style="margin-top: 10px;"><i class="fab fa-github"></i> <a href="${project.github}" target="_blank" style="color: #667eea; text-decoration: none;">View on GitHub</a></div>` : ''}
                    ${project.demo ? `<div style="margin-top: 5px;"><i class="fas fa-external-link-alt"></i> <a href="${project.demo}" target="_blank" style="color: #667eea; text-decoration: none;">Live Demo</a></div>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="portfolio-section">
            <div class="portfolio-section-title">Get In Touch</div>
            <div class="contact-info">
                ${portfolio.email ? `<div><strong>Email:</strong> ${portfolio.email}</div>` : ''}
                ${portfolio.phone ? `<div><strong>Phone:</strong> ${portfolio.phone}</div>` : ''}
            </div>
            ${portfolio.social.length > 0 ? `
            <div class="social-links">
                ${portfolio.social.map(social => `
                    <a href="${social.url}" target="_blank" class="social-link" title="${social.platform}">
                        <i class="fas fa-link"></i>
                    </a>
                `).join('')}
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Portfolio created with PortfolioX - Build Your Professional Story</p>
            <p>© ${new Date().getFullYear()} ${portfolio.name}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${portfolio.name.replace(/\s+/g, '_')}_portfolio.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Portfolio downloaded successfully!', 'success');
}

// ===== UTILITIES =====
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;

    if (type === 'error') {
        toast.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
    } else {
        toast.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function resetForms() {
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('signupPassword2').value = '';
}

function clearAllData() {
    if (confirm('This will delete all your data. Are you sure?')) {
        const email = app.currentUser.email;
        delete app.portfolios[email];
        saveDataToStorage();
        showToast('All data cleared', 'success');
        logout();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (document.body.dataset.page === 'dashboard' && e.ctrlKey && e.key === 's') {
        e.preventDefault();
        savePortfolioData();
        showToast('Portfolio saved!', 'success');
    }
});