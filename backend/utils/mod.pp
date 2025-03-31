mod "local" {
  title = "utils"
  require {
    mod "github.com/turbot/steampipe-mod-aws-compliance" {
      version = "*"
    }
    mod "github.com/turbot/steampipe-mod-kubernetes-compliance" {
      version = "*"
    }
  }
}