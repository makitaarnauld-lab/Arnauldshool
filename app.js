 // ===============================
        // CONFIG API
        // ===============================
        fetch("http://localhost:3000/api")
        .then(res => res.json())
        .then(data => console.log(data))
        .catch(err => console.error(err));
        const API_URL = 'http://localhost:3000';
        let currentUser = null;
        let premium = false;
        const pageMap = { home: 'homePage', courses: 'coursesPage', library: 'libraryPage', quiz: 'quizPage',
            chat: 'chatPage', account: 'accountPage' };
        const tabIndex = { home: 0, courses: 1, library: 2, quiz: 3, chat: 4, account: 5 };
        const questionBank = {
            math: [
                { q: 'Combien font 7×8 ?', options: ['48', '54', '56', '64'], ans: 2 },
                { q: 'Racine carrée de 144 ?', options: ['10', '12', '14', '16'], ans: 1 },
                { q: '2x+5=15, x=?', options: ['5', '10', '2', '7'], ans: 0 },
                { q: 'Périmètre carré côté 4 ?', options: ['8', '12', '16', '20'], ans: 2 }
            ],
            science: [
                { q: 'Symbole de l\'eau ?', options: ['O2', 'CO2', 'H2O', 'NaCl'], ans: 2 },
                { q: 'Gaz majoritaire air ?', options: ['Oxygène', 'Azote', 'CO2', 'Hélium'], ans: 1 },
                { q: 'Photosynthèse produit ?', options: ['CO2', 'O2', 'N2', 'H2O'], ans: 1 }
            ],
            french: [
                { q: 'Auteur "Les Misérables" ?', options: ['Hugo', 'Molière', 'Balzac', 'Zola'], ans: 0 },
                { q: 'Synonyme "magnifique" ?', options: ['Horrible', 'Superbe', 'Moyen', 'Petit'], ans: 1 },
                { q: '"Il ... au marché"', options: ['va', 'vas', 'vais', 'aller'], ans: 0 }
            ],
            history: [
                { q: 'Capitale Congo ?', options: ['Kinshasa', 'Brazzaville', 'Pointe-Noire', 'Dolisie'], ans: 1 },
                { q: 'Indépendance Congo ?', options: ['1958', '1960', '1962', '1965'], ans: 1 }
            ],
            english: [
                { q: 'Past tense of "go" ?', options: ['goed', 'went', 'gone', 'going'], ans: 1 },
                { q: 'Correct sentence:', options: ['He don\'t like', 'He doesn\'t like', 'He not like',
                        'He no like'
                    ], ans: 1 }
            ]
        };
        const subjects = [
            { id: 'math', name: 'Maths', icon: 'fa-calculator', color: '#667eea' },
            { id: 'science', name: 'Sciences', icon: 'fa-flask', color: '#f5576c' },
            { id: 'french', name: 'Français', icon: 'fa-book-open', color: '#4facfe' },
            { id: 'history', name: 'Histoire-Géo', icon: 'fa-globe-africa', color: '#8b5cf6' },
            { id: 'english', name: 'Anglais', icon: 'fa-language', color: '#ec4899' }
        ];
        const teachers = [
            { id: 't1', name: 'M. Kouka', avatar: 'K', subject: 'Maths' },
            { id: 't2', name: 'Mme Bantsimba', avatar: 'B', subject: 'Sciences' },
            { id: 't3', name: 'M. Ngoma', avatar: 'N', subject: 'Français' }
        ];
        let activeChatId = null;
        let messages = JSON.parse(localStorage.getItem('chat_messages') || '{"t1":[],"t2":[],"t3":[]}');
        let quizHistory = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        let currentQuiz = [],
            quizIndex = 0,
            quizScore = 0,
            answered = false;

        // ===============================
        // TOAST ERROR
        // ===============================
        function showError(msg) {
            const toast = document.getElementById('errorToast');
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
        }

        // ===============================
        // SPLASH SCREEN
        // ===============================
        function hideSplash() {
            const splash = document.getElementById('splashScreen');
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }

        // ===============================
        // AUTH
        // ===============================
        function toggleAuth(mode) {
            document.getElementById('loginFormContainer').classList.toggle('hidden', mode !== 'login');
            document.getElementById('registerFormContainer').classList.toggle('hidden', mode !== 'register');
        }

        async function handleLogin(e) {
            e.preventDefault();
            const login = document.getElementById('loginId').value;
            const password = document.getElementById('loginPass').value;
            try {
                const res = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login, password })
                });
                const data = await res.json();
                if (!data.success) return showError(data.message || 'Erreur connexion');
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                currentUser = data.user;
                premium = data.user.subscription_active;
                hideSplash();
                showApp();
            } catch (err) {
                showError('Impossible de contacter le serveur. Vérifiez que le backend est lancé sur le port 3000.');
            }
            return false;
        }

        async function handleRegister(e) {
            e.preventDefault();
            const fullName = document.getElementById('regFullName').value;
            const phone = document.getElementById('regPhone').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirm').value;
            const status = document.getElementById('regStatus').value;
            if (password !== confirm) return showError('Les mots de passe ne correspondent pas.');
            try {
                const res = await fetch(`${API_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, phone, email, password, status })
                });
                const data = await res.json();
                if (!data.success) return showError(data.message || 'Erreur inscription');
                alert('Compte créé avec succès');
                toggleAuth('login');
            } catch (err) {
                showError('Impossible de contacter le serveur. Vérifiez que le backend est lancé sur le port 3000.');
            }
            return false;
        }

        function showApp() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('appContainer').style.display = 'block';
            document.getElementById('displayUserName').innerHTML = '👋 Bonjour ' + currentUser.full_name.split(' ')[0];
            document.getElementById('profileNameDisplay').textContent = currentUser.full_name;
            document.getElementById('profileStatusDisplay').textContent = currentUser.status;
            updatePremiumUI();
            switchTab('home');
            buildSubjectSelector();
            buildContactList();
            loadProfileFromAPI();
        }

        function switchTab(tab) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
            document.getElementById(pageMap[tab]).classList.add('active-page');
            document.querySelectorAll('.nav-item').forEach((el, i) => el.classList.toggle('active-nav', i === tabIndex[
                tab]));
            if (tab === 'quiz') buildSubjectSelector();
        }

        function updatePremiumUI() {
            document.getElementById('premiumStatus').textContent = premium ? 'Premium' : 'Gratuit';
        }

        async function loadProfileFromAPI() {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/profile`, {
                    headers: { Authorization: 'Bearer ' + token }
                });
                if (res.ok) {
                    const user = await res.json();
                    document.getElementById('profileNameDisplay').textContent = user.full_name || currentUser
                        .full_name;
                    document.getElementById('profileStatusDisplay').textContent = user.status || currentUser.status;
                    premium = user.subscription_active;
                    updatePremiumUI();
                }
            } catch (err) { /* silencieux */ }
        }

        // ===============================
        // PAIEMENT MTN
        // ===============================
        async function buyPremium() {
            const phone = prompt('Entrez votre numéro MTN Mobile Money');
            if (!phone) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/payments/mtn`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                    body: JSON.stringify({ amount: 1000, phoneNumber: phone, planId: '30days' })
                });
                const data = await res.json();
                if (data.success) {
                    premium = true;
                    updatePremiumUI();
                    alert('Paiement MTN envoyé. Validez la transaction sur votre téléphone.');
                } else {
                    showError(data.message || 'Erreur paiement');
                }
            } catch (err) {
                showError('Erreur serveur lors du paiement.');
            }
        }

        // ===============================
        // TÉLÉCHARGEMENT COURS
        // ===============================
        function downloadCourse(title) {
            if (!premium) return showError('Abonnement Premium requis pour télécharger.');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(`Cours : ${title}`, 10, 20);
            doc.setFontSize(12);
            doc.text('Arnauldschool - Congo Brazzaville', 10, 30);
            doc.save(`${title}.pdf`);
        }

        // ===============================
        // QUIZ
        // ===============================
        function buildSubjectSelector() {
            const c = document.getElementById('subjectSelector');
            c.innerHTML = '';
            subjects.forEach(s => {
                const b = document.createElement('button');
                b.className = 'subject-btn';
                b.innerHTML = `<i class="fas ${s.icon}"></i> ${s.name}`;
                b.onclick = () => startQuiz(s.id);
                c.appendChild(b);
            });
        }

        function startQuiz(id) {
            if (!questionBank[id] || !questionBank[id].length) return showError('Pas de questions disponibles.');
            currentQuiz = questionBank[id];
            quizIndex = 0;
            quizScore = 0;
            answered = false;
            document.getElementById('quizArea').style.display = 'block';
            document.getElementById('quizResultArea').style.display = 'none';
            document.getElementById('evolutionBtn').style.display = 'none';
            renderQuestion();
        }

        function renderQuestion() {
            if (quizIndex >= currentQuiz.length) { quizFinished(); return; }
            const q = currentQuiz[quizIndex];
            document.getElementById('quizArea').innerHTML = `
        <div class="quiz-container">
        <h3>Question ${quizIndex+1}/${currentQuiz.length}</h3>
        <p style="font-size:18px;">${q.q}</p>
        <div id="optionsContainer"></div>
        <div id="quizFeedback" style="margin-top:15px;font-weight:600;"></div>
        <div style="margin-top:15px;display:flex;justify-content:space-between;">
        <span>Score: ${quizScore}</span>
        <button id="nextBtn" class="btn-outline" style="display:none;" onclick="nextQuestion()">Suivante</button>
        </div>
        </div>`;
            const oc = document.getElementById('optionsContainer');
            q.options.forEach((o, i) => {
                const b = document.createElement('button');
                b.className = 'quiz-option';
                b.textContent = `${String.fromCharCode(65+i)}. ${o}`;
                b.onclick = () => selectAnswer(i);
                oc.appendChild(b);
            });
        }

        function selectAnswer(i) {
            if (answered) return;
            answered = true;
            const q = currentQuiz[quizIndex];
            document.querySelectorAll('.quiz-option').forEach((b, j) => {
                b.disabled = true;
                if (j === q.ans) b.classList.add('correct');
                if (j === i && j !== q.ans) b.classList.add('wrong');
            });
            if (i === q.ans) quizScore++;
            document.getElementById('quizFeedback').textContent = i === q.ans ? '✅ Bonne réponse !' :
                '❌ Mauvaise réponse.';
            document.getElementById('nextBtn').style.display = (quizIndex < currentQuiz.length - 1) ? 'inline-block' :
                'none';
            if (quizIndex === currentQuiz.length - 1) setTimeout(quizFinished, 2000);
        }

        function nextQuestion() { quizIndex++;
            answered = false;
            renderQuestion(); }

        function quizFinished() {
            document.getElementById('quizArea').style.display = 'none';
            const ra = document.getElementById('quizResultArea');
            ra.style.display = 'block';
            const sn = subjects.find(s => questionBank[s.id] === currentQuiz)?.name || 'Inconnu';
            ra.innerHTML =
                `<div class="quiz-container" style="text-align:center;"><h2>🎉 Félicitations !</h2><p>Score: ${quizScore}/${currentQuiz.length}</p><button class="btn-outline" onclick="startQuiz('${subjects.find(s=>questionBank[s.id]===currentQuiz)?.id||'math'}')">Refaire un quiz</button></div>`;
            quizHistory.push({ subject: sn, score: quizScore, total: currentQuiz.length, date: new Date()
                    .toISOString() });
            localStorage.setItem('quizHistory', JSON.stringify(quizHistory));
            document.getElementById('evolutionBtn').style.display = 'inline-block';
        }

        function showEvolution() {
            if (!quizHistory.length) return showError('Aucune session terminée.');
            let h = '<ul style="list-style:none;padding:0;">';
            quizHistory.slice().reverse().forEach(r => h +=
                `<li style="margin-bottom:8px;background:var(--card);padding:10px;border-radius:10px;"><strong>${r.subject}</strong>: ${r.score}/${r.total} (${new Date(r.date).toLocaleDateString()})</li>`
                );
            h += '</ul>';
            document.getElementById('quizResultArea').innerHTML =
            `<div class="quiz-container"><h3>Historique</h3>${h}</div>`;
            document.getElementById('quizResultArea').style.display = 'block';
        }

        // ===============================
        // CHAT
        // ===============================
        function buildContactList() {
            const l = document.getElementById('contactList');
            l.innerHTML =
                '<button class="new-chat-btn" onclick="openNewChatModal()"><i class="fas fa-plus"></i> Nouvelle discussion</button>';
            teachers.forEach(t => {
                const d = document.createElement('div');
                d.className = 'contact-item';
                d.id = 'contact-' + t.id;
                d.innerHTML =
                    `<div style="width:35px;height:35px;border-radius:50%;background:var(--congo-green);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;">${t.avatar}</div><span>${t.name}</span>`;
                d.onclick = () => openChat(t.id);
                l.appendChild(d);
            });
        }

        function openChat(id) {
            activeChatId = id;
            document.querySelectorAll('.contact-item').forEach(c => c.classList.remove('active-chat'));
            document.getElementById('contact-' + id).classList.add('active-chat');
            renderChat(id);
        }

        function renderChat(id) {
            if (!messages[id]) messages[id] = [];
            document.getElementById('chatArea').innerHTML = `
        <div class="chat-messages" id="chatMsgs"></div>
        <div class="chat-input-area">
        <input type="text" id="chatInput" placeholder="Écrivez..."><button onclick="sendMsg()"><i class="fas fa-paper-plane"></i></button>
        </div>`;
            const m = document.getElementById('chatMsgs');
            messages[id].forEach(msg => {
                const d = document.createElement('div');
                d.className = `chat-msg ${msg.sender==='user'?'sent':'received'}`;
                d.innerHTML = `<div class="chat-bubble">${msg.text}</div>`;
                m.appendChild(d);
            });
        }

        function sendMsg() {
            if (!activeChatId) return;
            const i = document.getElementById('chatInput');
            const t = i.value.trim();
            if (!t) return;
            messages[activeChatId].push({ sender: 'user', text: t });
            localStorage.setItem('chat_messages', JSON.stringify(messages));
            i.value = '';
            renderChat(activeChatId);
        }

        function openNewChatModal() {
            document.getElementById('newChatModal').classList.remove('hidden');
            const tl = document.getElementById('teacherList');
            tl.innerHTML = '';
            teachers.forEach(t => {
                const b = document.createElement('button');
                b.className = 'btn-outline';
                b.textContent = t.name + ' (' + t.subject + ')';
                b.onclick = () => { openChat(t.id);
                    closeNewChatModal(); };
                tl.appendChild(b);
            });
        }

        function closeNewChatModal() { document.getElementById('newChatModal').classList.add('hidden'); }

        function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }

        // ===============================
        // INIT
        // ===============================
        window.onload = () => {
                const token = localStorage.getItem('token');
                const user = JSON.parse(localStorage.getItem('user') || 'null');
                if (token && user) {
                    currentUser = user;
                    premium = user.subscription_active;
                    document.getElementById('authSection').style.display = 'none';
                    document.getElementById('appContainer').style.display = 'block';
                    document.getElementById('displayUserName').innerHTML = '👋 Bonjour ' + currentUser.full_name.split(
                        ' ')[0];
                    document.getElementById('profileNameDisplay').textContent = currentUser.full_name;
                    document.getElementById('profileStatusDisplay').textContent = currentUser.status;
                    updatePremiumUI();
                    buildSubjectSelector();
                    buildContactList();
                    switchTab('home');
                    loadProfileFromAPI();
                    setTimeout(hideSplash, 2000);
                } else {
                    document.getElementById('authSection').style.display = 'flex';
                    document.getElementById('appContainer').style.display = 'none';
                    setTimeout(hideSplash, 2500);
                }
            };