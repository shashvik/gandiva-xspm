# Gandiva: Cloud Security Posture Management (CSPM)

Gandiva is a comprehensive Cloud Security Posture Management (CSPM) platform designed to help organizations monitor, assess, and enhance their cloud security posture across multi-cloud environments. It provides visibility into cloud resources, identifies security vulnerabilities, and offers remediation recommendations.
![image](https://github.com/user-attachments/assets/f13f6ec5-dd32-4667-850e-a6c791e50af7)


## How to deploy
- **Prerequisites**: Make sure you have docker installed, and also have AWS credentials configured, have the kubeconfig setup, and build the images from source


### Docker Deployment

The application can be containerized using Docker: Simply clone this repository and run the below commands

1. Build the images:
   ```
   docker build -t gandiva-backend -f Dockerfile.backend .
   docker build -t gandiva-frontend -f Dockerfile.frontend .
   ```

2. Run the containers:
   ```
   chmod +x start_gandiva.sh
   ./start_gandiva.sh
   ```

## Key Features

- **Multi-Cloud Asset Inventory**: Comprehensive view of AWS, Kubernetes, and other cloud resources
- **Security Findings**: Detection of misconfigurations and compliance violations
- **Relationship Visualization**: Graph-based visualization of resource relationships
- **Vulnerability Management**: Track and remediate vulnerabilities in cloud resources
- **Benchmark Compliance**: Assess compliance with industry standards (CIS, NIST)
- **Container Security**: Identify vulnerable container images and configurations
- **Database Security**: Assess and monitor database security posture
- **Secret Detection**: Identify exposed secrets in code repositories
- **Interactive Dashboard**: Intuitive interface for security insights

## Architecture

Gandiva consists of three main components:

1. **Backend API**: Flask-based RESTful API server that integrates with various scanning tools
2. **Frontend UI**: React application providing an intuitive user interface
3. **Analysis Engine**: Integration with Steampipe and Neo4j for data analysis and visualization

### Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, React Flow
- **Backend**: Python, Flask, Flask-RESTful, JWT Authentication
- **Databases**: MongoDB for application data, Neo4j for graph visualization
- **Scanning**: Steampipe for cloud resource scanning
- **Deployment**: Docker containers, can be deployed on Kubernetes

## Project Structure

```
gandiva/
├── backend/              # Flask backend application
│   ├── app.py            # Main application entry point
│   ├── resources.py      # API resources and endpoints
│   ├── neo4j_*.py        # Neo4j integration
│   ├── steampipe_*.py    # Steampipe integration
│   └── *_scanner_*.py    # Various scanners
├── frontend/             # React frontend application
│   ├── src/              # Source code
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   └── services/     # API services
│   └── public/           # Static assets
└── Dockerfile.*          # Docker build configurations
```


## Cloud Resource Scanning

Gandiva uses Steampipe to scan cloud resources. You'll need to configure appropriate cloud provider credentials:

### AWS Configuration

```bash
# Configure AWS credentials
aws configure
```

### Kubernetes Configuration

Ensure your kubeconfig is properly set up to access your Kubernetes clusters.

## Security Considerations

- All API endpoints use JWT token authentication
- Role-based access control for administrative functions
- Credentials for cloud scanning are stored securely
- Token refresh mechanism for persistent sessions

## Documentation

- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Authentication Guide](./frontend/README-AUTH.md)



