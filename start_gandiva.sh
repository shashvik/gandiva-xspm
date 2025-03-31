#!/bin/sh

echo "🚀 Setting up Gandiva environment..."

# make sure they have built the dockerfiles
echo "Make sure you have the dockerfiles built for the frontend and the backend"
echo ""
echo "✅ You just need to clone the repo and run the below from there"
echo ""
echo "docker build -t gandiva-frontend -f Dockerfile.frontend ."
echo ""
echo "docker build -t gandiva-backend -f Dockerfile.backend ."
echo ""
echo ""

# Pre-checks for AWS and Kubeconfig setup
echo "Please ensure you have configured AWS credentials and kubeconfig before proceeding:"
echo ""
echo "   ✅ AWS credentials should be set up using 'aws configure' and stored in ~/.aws you can use only secret key and access key and also can use session keys as well"
echo ""
echo "   ✅ Kubeconfig should be properly configured and stored in ~/.kube"
echo ""
echo "   If these are not set up correctly, please do so before running this script!"
echo ""
echo ""


# Create Docker network if not exists
docker network inspect gandiva-network >/dev/null 2>&1 || docker network create gandiva-network


echo "✅ Created/Verified Docker network: gandiva-network"
echo ""

# Start MongoDB
echo "🔄 Starting MongoDB..."
echo ""
docker run -d \
  --name gandiva-mongo \
  --network gandiva-network \
  -p 27017:27017 \
  mongo:latest

# Start Frontend
echo "🔄 Starting Frontend..."
echo ""
docker run -d \
  --name gandiva-frontend \
  --network gandiva-network \
  -p 8080:8080 \
  gandiva-frontend

# Start Backend with AWS & Kubeconfig Volumes
echo "🔄 Starting Backend..."
echo ""
docker run -d \
  --name gandiva-backend \
  --network gandiva-network \
  -e MONGO_URI=mongodb://gandiva-mongo:27017/ \
  -p 5000:5000 \
  -v ~/.aws:/home/appuser/.aws:ro \
  -v ~/.aws:/root/.aws:ro \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.kube:/home/appuser/.kube:ro \
  -v ~/.kube:/root/.kube:ro \
  gandiva-backend



# Start Neo4j
echo "🔄 Starting Neo4j..."
echo ""
docker run -d \
  --name gandiva-neo4j \
  --network gandiva-network \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -e NEO4JLABS_PLUGINS='["apoc"]' \
  -v neo4j_data:/data \
  neo4j


# Show running containers
echo "📋 Listing running containers..."
echo ""
docker ps









# Post-Setup Instructions
echo ""
echo "🔄 How to Sync Data:"
echo ""
echo "➡ Go to the Settings page and under 'Asset & Vulnerability Management':"
echo "   1️⃣ Click on 'AWS Assets'"
echo "   2️⃣ Click on 'Docker Vulnerabilities'"
echo "   3️⃣ Click on 'Known Exploited Vulnerabilities'"
echo "   4️⃣ Click on 'Correlated Exploits'"
echo ""
echo ""
echo "➡ Under 'Neo4j Graph Database Sync':"
echo "   1️⃣ Click on 'Assets'"
echo "   2️⃣ Click on 'Docker Vulnerabilities'"
echo "   3️⃣ Click on 'Kubernetes Assets'"
echo "   4️⃣ Click on 'Known Exploited Vulnerabilities'"
echo "   5️⃣ Click on 'S3 Compliance'"
echo "   6️⃣ Click on 'Database Compliance'"
echo "   7️⃣ Click on 'Relationships'"
echo ""
echo ""
echo "🛡️ Security Benchmarks:"
echo "➡ Under 'Cloud Security Controls', click 'Run Benchmarks'."
echo "➡ Under 'Kubernetes Security Controls', click 'Run K8s Benchmarks'."
echo ""
echo ""
echo "🗄️ Database Security Configuration:"
echo "➡ Add a database with the following details:"
echo "   - Name: <RDS DB Endpoint> (e.g., api-db.cahi9satosrj.us-east-1.rds.amazonaws.com)"
echo "   - Database Type: mysql or postgres"
echo "   - Host: <RDS DB Endpoint> (e.g., api-db.cahi9satosrj.us-east-1.rds.amazonaws.com)"
echo "   - Database: <Database name, e.g., customers>"
echo "   - Username: <DB user with read permissions>"
echo "   - Password: <DB user password>"
echo "➡ Click the 'Search' icon to start scanning."
echo ""
echo ""
echo "📜 IaC & Secret Scanning:"
echo "➡ Click 'Add' and enter:"
echo "   - Credential Name: <Your GitHub Username>"
echo "   - GitHub Repository URL: <Repo URL>"
echo "   - GitHub Username: <Your GitHub Username>"
echo "   - GitHub PAT Token: <Personal Access Token with read permissions>"
echo ""
echo ""
echo "✅ All setup complete! Start securing your environment now!"
echo ""

# Final message
echo "✅ Gandiva environment setup complete!"
echo "🌐 Open http://localhost:8080 to access the frontend."
echo "🔑 Default Credentials:"
echo "   👉 Username: gandiva"
echo "   👉 Password: gandiva_password"
echo ""
echo ""

# Wait 5 minutes for all services to initialize
echo "⏳ Wait upto 5 minutes for all services to start..."
echo ""
echo "NOTE: PLEASE HAVE PATIENCE AS WHILE SYNC DATA IT TAKES SOME TIME TO SYNC ALL THE DATA 🔄"
echo ""
echo ""