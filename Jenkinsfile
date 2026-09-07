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
                echo 'Deployment stage placeholder — plug in your target environment (Docker/SSH/PaaS) here.'
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
