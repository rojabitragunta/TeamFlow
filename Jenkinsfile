pipeline {
    agent any

    environment {
        PYTHON = 'python'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('backend') {
                    sh '''
                        ${PYTHON} -m venv venv
                        . venv/bin/activate
                        pip install --upgrade pip
                        pip install -r requirements.txt
                    '''
                }
            }
        }

        stage('Run Tests') {
            steps {
                dir('backend') {
                    sh '''
                        . venv/bin/activate
                        pytest -v --junitxml=test-results.xml
                    '''
                }
            }
            post {
                always {
                    junit 'backend/test-results.xml'
                }
            }
        }

        stage('Build / Validate') {
            steps {
                dir('backend') {
                    sh '''
                        . venv/bin/activate
                        python -c "from app.main import app; print('FastAPI app imports OK:', app.title)"
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo '''
                Deploy stage is intentionally NOT implemented.

                This project has no configured deployment target, hosting
                credentials, or container registry, so this pipeline cannot
                safely deploy anything yet — faking a deploy step here would
                be misleading. CI is fully functional (checkout, install,
                test, build-validate above); this stage is where a real
                deployment goes once a target exists.

                To make this stage real, you need ALL of:
                  1. A deployment target (Docker registry + host, a PaaS like
                     Render/Railway/Fly.io, or a VM reachable via SSH).
                  2. Credentials for that target, stored in Jenkins
                     "Manage Credentials" (never hardcoded in this file) and
                     referenced here via credentials(...) bindings.
                  3. Production environment variables set on the target
                     itself (not in this repo): ENVIRONMENT=production,
                     a strong JWT_SECRET, real DB_* values, CORS_ORIGINS set
                     to the real frontend domain, and ADMIN_SETUP_TOKEN if
                     you need to bootstrap an admin account.
                  4. The frontend's API base URL (frontend/js/config.js)
                     pointed at that same backend's public URL.

                Once those exist, replace this echo with the actual deploy
                steps (e.g. `docker build/push` + a remote restart, or an
                `sh` block calling your PaaS CLI).
                '''
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed — check the test and build stage logs above.'
        }
        success {
            echo 'Pipeline completed successfully.'
        }
    }
}
