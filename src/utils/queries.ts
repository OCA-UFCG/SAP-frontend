export const MAIN_BANNER_QUERY = `
  query($preview: Boolean) {
    mainBannerCollection(limit: 1, preview: $preview) {
      items {
        title
        subtitle
        buttonUrl
        buttonLabel
        image {
          url
        }
      }
    }
  }
`;