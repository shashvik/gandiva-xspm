#!/usr/bin/env python3
"""
Standalone script for syncing AWS assets from Steampipe to MongoDB.
This can be run as a cron job or manually to keep the asset inventory up-to-date.
"""

import argparse
import logging
import sys
from steampipe_manager import SteampipeManager

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('steampipe_sync.log')
    ]
)
logger = logging.getLogger('sync_script')

def main():
    """Main entry point for the sync script."""
    parser = argparse.ArgumentParser(description='Sync AWS assets from Steampipe to MongoDB')
    parser.add_argument('--resource-type', '-r', type=str, help='Specific resource type to sync (e.g., ec2, s3)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Set log level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")
    
    try:
        # If resource type is specified, sync only that type
        if args.resource_type:
            logger.info(f"Starting sync for {args.resource_type} assets...")
            result = SteampipeManager.sync_resource_type(args.resource_type)
            
            if 'error' in result:
                logger.error(result['error'])
                return 1
                
            logger.info(f"Successfully synced {result['count']} {args.resource_type} assets")
            return 0
        
        # Otherwise sync all assets
        logger.info("Starting full AWS asset sync...")
        result = SteampipeManager.sync_all_assets()
        
        # Log results
        logger.info(f"Sync completed. Total assets: {result['total']}")
        for resource_type, count in result.items():
            if resource_type not in ['total', 'execution_time', 'timestamp']:
                logger.info(f"- {resource_type}: {count} assets")
                
        logger.info(f"Execution time: {result['execution_time']}")
        return 0
        
    except Exception as e:
        logger.error(f"Error running sync: {str(e)}")
        return 1

if __name__ == '__main__':
    sys.exit(main()) 